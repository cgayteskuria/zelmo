<?php

namespace App\Services;

use App\Models\AccountTransferModel;
use App\Models\AccountMoveModel;
use App\Models\AccountMoveLineModel;
use App\Models\AccountJournalModel;
use App\Models\AccountModel;
use App\Models\AccountConfigModel;
use App\Models\InvoiceModel;
use App\Models\PaymentModel;
use App\Models\ExpenseReportModel;
use App\Services\TaxTagResolver;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

/**
 * Service de transfert comptable conforme au Plan Comptable Général (PCG) français
 * 
 * Règles appliquées:
 * - Principe de la partie double (débit = crédit)
 * - Numérotation continue des écritures par journal
 * - Respect de l'ordre chronologique
 * - Comptes de classe appropriés (classe 4 pour tiers, classe 6/7 pour charges/produits)
 * - Lettrage des comptes tiers
 */

class AccountTransferService
{
    private ?AccountConfigModel $accountConfig = null;

    /**
     * Récupère la configuration comptable par défaut (ID=1) avec mise en cache
     *
     * @return AccountConfigModel
     * @throws \Exception
     */
    private function getAccountConfig(): AccountConfigModel
    {
        if ($this->accountConfig !== null) {
            return $this->accountConfig;
        }

        $config = AccountConfigModel::with([
            'saleAccount',
            'purchaseAccount',
            'customerAccount',
            'supplierAccount',
            'bankAccount',
            'saleJournal',
            'purchaseJournal',
            'bankJournal',
            'saleDepositAccount',
            'purchaseDepositAccount',
            'saleVatWaitingAccount',
            'purchaseVatWaitingAccount',
            'miscJournal',
        ])->find(1);

        if (!$config) {
            throw new \Exception(
                'Configuration comptable par défaut (ID=1) introuvable'
            );
        }

        return $this->accountConfig = $config;
    }
    /**
     * Extrait les mouvements comptables à transférer
     *
     * @param string $startDate Format Y-m-d
     * @param string $endDate Format Y-m-d
     * @return array
     */
    public function extractMovesToTransfer(string $startDate, string $endDate, bool $includeAccounted = false): array
    {
        $movements = [];
        $errors = [];

        try {
            // 1. Extraire les factures validées non comptabilisées (inv_status = 1)
            // ou comptabilisées si $includeAccounted = true (inv_status = 2)
            $statusToInclude = $includeAccounted
                ? [InvoiceModel::STATUS_FINALIZED, InvoiceModel::STATUS_ACCOUNTED]
                : [InvoiceModel::STATUS_FINALIZED];

            $invoices = InvoiceModel::whereIn('inv_status', $statusToInclude)
                ->where(fn($q) => $q->where("inv_being_edited", false)->orWhereNull("inv_being_edited"))
                ->whereBetween('inv_date', [$startDate, $endDate])
                ->with([
                    'lines.product.accountSale',
                    'lines.product.accountPurchase',
                    'lines.tax',
                    'partner.customerAccount',
                    'partner.supplierAccount',
                ])
                ->get();

            foreach ($invoices as $invoice) {
                try {
                    $movement = $this->buildMoveFromInvoice($invoice);
                    if ($movement) {
                        $movements = array_merge($movements, $movement['moveLines']);
                    }
                } catch (\Exception $e) {
                    $errors[] = [
                        'type' => 'invoice',
                        'reference' => $invoice->inv_number,
                        'message' => $e->getMessage()
                    ];
                }
            }

            // 2. Extraire les paiements validés non comptabilisés (pay_status = 1)
            // ou comptabilisés si $includeAccounted = true (pay_status = 2)
            // Requêtes séparées pour optimiser le chargement des relations selon le type de paiement
            $paymentStatusToInclude = $includeAccounted
                ? [PaymentModel::STATUS_DRAFT, 2] // 2 = comptabilisé
                : [PaymentModel::STATUS_DRAFT];

            // 2.1 Paiements avec acompte
            $depositPayments = PaymentModel::where(function ($q) use ($paymentStatusToInclude) {
                $q->whereIn('pay_status', $paymentStatusToInclude)
                    ->orWhereNull('pay_status');
            })
                ->whereBetween('pay_date', [$startDate, $endDate])
                ->whereNull('fk_inv_id_refund')
                ->whereNotNull('fk_inv_id_deposit')
                ->with([
                    'depositInvoice',
                    'allocations.invoice.partner',
                    'bankDetails.account',
                ])
                ->get();

            foreach ($depositPayments as $payment) {
                try {
                    $movement = $this->buildMoveFromDepositPayment($payment);
                    if ($movement) {
                        $movements = array_merge($movements, $movement['moveLines']);
                    }
                } catch (\Exception $e) {
                    $errors[] = [
                        'type' => 'payment',
                        'reference' => $payment->pay_number ?? "Paiement #{$payment->pay_id}",
                        'message' => $e->getMessage()
                    ];
                }
            }

            // 2.2 Paiements de charges
            $chargePayments = PaymentModel::where(function ($q) use ($paymentStatusToInclude) {
                $q->whereIn('pay_status', $paymentStatusToInclude)
                    ->orWhereNull('pay_status');
            })
                ->whereBetween('pay_date', [$startDate, $endDate])
                ->whereNull('fk_inv_id_refund')
                ->whereNull('fk_inv_id_deposit')
                ->where('pay_operation', PaymentModel::OPERATION_CHARGE_PAYMENT)
                ->with([
                    'allocations.charge.type.account',
                    'bankDetails.account',
                ])
                ->get();

            foreach ($chargePayments as $payment) {
                try {
                    $movement = $this->buildMoveFromChargePayment($payment);
                    if ($movement) {
                        $movements = array_merge($movements, $movement['moveLines']);
                    }
                } catch (\Exception $e) {
                    $errors[] = [
                        'type' => 'payment',
                        'reference' => $payment->pay_number ?? "Paiement #{$payment->pay_id}",
                        'message' => $e->getMessage()
                    ];
                }
            }

            // 2.3 Paiements de notes de frais
            $expenseReportPayments = PaymentModel::where(function ($q) use ($paymentStatusToInclude) {
                $q->whereIn('pay_status', $paymentStatusToInclude)
                    ->orWhereNull('pay_status');
            })
                ->whereBetween('pay_date', [$startDate, $endDate])
                ->whereNull('fk_inv_id_refund')
                ->whereNull('fk_inv_id_deposit')
                ->where('pay_operation', PaymentModel::OPERATION_EXPENSE_REPORT_PAYMENT)
                ->with([
                    'allocations.expenseReport.user.employeeAccount',
                    'bankDetails.account',
                ])
                ->get();

            foreach ($expenseReportPayments as $payment) {
                try {
                    $movement = $this->buildMoveFromExpenseReportPayment($payment);
                    if ($movement) {
                        $movements = array_merge($movements, $movement['moveLines']);
                    }
                } catch (\Exception $e) {
                    $errors[] = [
                        'type' => 'payment',
                        'reference' => $payment->pay_number ?? "Paiement #{$payment->pay_id}",
                        'message' => $e->getMessage()
                    ];
                }
            }

            // 2.4 Paiements de factures classiques (par règlement bancaire)
            $invoicePayments = PaymentModel::where(function ($q) use ($paymentStatusToInclude) {
                $q->whereIn('pay_status', $paymentStatusToInclude)
                    ->orWhereNull('pay_status');
            })
                ->whereBetween('pay_date', [$startDate, $endDate])
                ->whereNull('fk_inv_id_refund')
                ->whereNull('fk_inv_id_deposit')
                ->whereIn('pay_operation', [
                    PaymentModel::OPERATION_CUSTOMER_PAYMENT,
                    PaymentModel::OPERATION_SUPPLIER_PAYMENT
                ])
                ->with([
                    'allocations.invoice.partner',
                    'allocations.invoice.lines.tax',
                    'bankDetails.account',
                    'partner',
                ])
                ->get();

            foreach ($invoicePayments as $payment) {
                try {
                    $movement = $this->buildMoveFromInvoicePayment($payment);
                    if ($movement) {
                        $movements = array_merge($movements, $movement['moveLines']);
                        if (!empty($movement['odMoveLines'])) {
                            $movements = array_merge($movements, $movement['odMoveLines']);
                        }
                        // Instructions AMR (type='amr_update') : injectées dans le tableau movements,
                        // filtrées et appliquées après tous les saveWithValidation dans processTransfer.
                        if (!empty($movement['amrStatusUpdates'])) {
                            $movements = array_merge($movements, $movement['amrStatusUpdates']);
                        }
                    }
                } catch (\Exception $e) {
                    $errors[] = [
                        'type' => 'payment',
                        'reference' => $payment->pay_number ?? "Paiement #{$payment->pay_id}",
                        'message' => $e->getMessage()
                    ];
                }
            }

            // 3. Extraire les notes de frais approuvées non comptabilisées
            // ou comptabilisées si $includeAccounted = true
            $expenseStatusToInclude = $includeAccounted
                ? ['approved', 'accounted']
                : ['approved'];

            $expenseReports = ExpenseReportModel::whereIn('exr_status', $expenseStatusToInclude)
                ->whereBetween('exr_approval_date', [$startDate, $endDate])
                ->with([
                    'user.employeeAccount',
                    'expenses.category.account',
                    'expenses.lines.tax',
                ])
                ->get();

            foreach ($expenseReports as $expenseReport) {
                try {
                    $movement = $this->buildMoveFromExpenseReport($expenseReport);
                    if ($movement) {
                        $movements = array_merge($movements, $movement['moveLines']);
                    }
                } catch (\Exception $e) {
                    $errors[] = [
                        'type' => 'expense_report',
                        'reference' => $expenseReport->exr_number,
                        'message' => $e->getMessage()
                    ];
                }
            }

            // ── Validation TVA bloquante ─────────────────────────────────────────
            // Collecte chaque paire unique (tax_id × document_type) dans le lot.
            // La validation TVA est désormais gérée par le boot hook creating de AccountMoveLineModel.
            // Toute config manquante lève une InvalidArgumentException → rollback automatique.

            return [
                'movements' => $movements,
                'errors' => $errors,
                'count' => count($movements),
                'errorsCount' => count($errors)
            ];
        } catch (\RuntimeException $e) {
            throw $e; // Erreurs de validation bloquantes (TVA, etc.) : remonter tel quel
        } catch (\Exception $e) {
            throw new \Exception("Erreur lors de l'extraction des mouvements: " . $e->getMessage());
        }
    }


    /**
     * Construit un mouvement comptable depuis une facture
     * Conforme au PCG français
     */
    private function buildMoveFromInvoice(InvoiceModel $invoice): ?array
    {
        try {
            if (!$invoice->partner) {
                throw new \Exception("Facture {$invoice->inv_number} sans tiers associé");
            }

            $journal = $this->getJournalCodeForInvoice($invoice);
            $journalId = $journal["id"];
            $journalCode = $journal["code"];
            $lines = [];

            // Déterminer si c'est une facture client ou fournisseur
            $isCustomerInvoice = in_array($invoice->inv_operation, [
                InvoiceModel::OPERATION_CUSTOMER_INVOICE,
                InvoiceModel::OPERATION_CUSTOMER_REFUND,
                InvoiceModel::OPERATION_CUSTOMER_DEPOSIT,
            ]);

            $isRefund = in_array($invoice->inv_operation, [
                InvoiceModel::OPERATION_CUSTOMER_REFUND,
                InvoiceModel::OPERATION_SUPPLIER_REFUND,
            ]);

            $documentType = $isCustomerInvoice
                ? ($isRefund ? 'out_refund' : 'out_invoice')
                : ($isRefund ? 'in_refund'  : 'in_invoice');

            $isDeposit = in_array($invoice->inv_operation, [
                InvoiceModel::OPERATION_CUSTOMER_DEPOSIT,
                InvoiceModel::OPERATION_SUPPLIER_DEPOSIT,
            ]);

            // Récupération du compte tiers (411xxx ou 401xxx)
            $partnerAccount = $this->getPartnerAccount($invoice->partner, $isCustomerInvoice);

            // Libellé normalisé selon les usages français
            $docType = $isRefund ? 'Avoir' : ($isDeposit ? 'Acompte' : 'Facture');
            $moveLabel = "{$docType} {$invoice->inv_number} - {$invoice->partner->ptr_name}";
            if ($invoice->inv_externalreference) {
                $moveLabel .= " (Réf: {$invoice->inv_externalreference})";
            }

            $commonLineData = [
                'type' => 'inv',
                'move_id' => $invoice->inv_id,
                'journal_code' => $journalCode,
                'journal_id' => $journalId,
                'number' => $invoice->inv_number,
                'date' => $invoice->inv_date->format('Y-m-d'),
                'move_label' => $moveLabel,
                'document_type' => $documentType,
            ];

            // === LIGNE 1: Compte tiers (411 ou 401) ===
            // Règle PCG: 
            // - Facture client: débit 411 (créance)
            // - Facture fournisseur: crédit 401 (dette)
            // - Avoirs: inverse
            $partnerDebit = 0;
            $partnerCredit = 0;

            // inv_totalttc est négatif pour les avoirs — toujours travailler en valeur absolue
            $totalTtc = abs($invoice->inv_totalttc);

            if ($isCustomerInvoice) {
                // Facture client: je constate une créance (débit 411)
                // Avoir client: je rembourse (crédit 411)
                $partnerDebit = $isRefund ? 0 : $totalTtc;
                $partnerCredit = $isRefund ? $totalTtc : 0;
            } else {
                // Facture fournisseur: je constate une dette (crédit 401)
                // Avoir fournisseur: diminution de dette (débit 401)
                $partnerDebit = $isRefund ? $totalTtc : 0;
                $partnerCredit = $isRefund ? 0 : $totalTtc;
            }

            $lines[] = array_merge($commonLineData, [
                'account_id' => $partnerAccount['id'],
                'account_code' => $partnerAccount['code'],
                'debit' => round($partnerDebit, 2),
                'credit' => round($partnerCredit, 2),
            ]);

            if ($isDeposit) {
                /*
                * =========================
                * TRAITEMENT ACOMPTE
                * =========================
                * Une facture d'acompte ne peut être comptabilisée que si elle est intégralement réglée.
                * Règle métier : le paiement de l'acompte doit couvrir 100% du montant TTC.
                */
                $totalPaid = (float) DB::table('payment_allocation_pal')
                    ->where('fk_inv_id', $invoice->inv_id)
                    ->sum('pal_amount');

                $remaining = abs($invoice->inv_totalttc) - round($totalPaid, 2);

                if ($remaining > 0.01) {
                    return null; // Acompte non intégralement réglé → ignoré silencieusement
                }

                $depositAccount = $this->getDepositAccount($isCustomerInvoice);
                $lines[] = array_merge($commonLineData, [
                    'account_id'   => $depositAccount['id'],
                    'account_code' => $depositAccount['code'],
                    'debit' => round($partnerCredit, 2),
                    'credit' => round($partnerDebit, 2),
                ]);
            } else {
                /*
                * =========================
                * FACTURE CLASSIQUE
                * =========================
                */

                // === LIGNES 2+: Comptes de produits/charges (classe 6 ou 7) ===
                $productLinesGrouped = [];
                $taxLinesGrouped = [];

                foreach ($invoice->lines as $line) {
                    if ($line->inl_type != 0) continue; // Ignorer commentaires/sous-totaux

                    // Déterminer le compte de produit/charge
                    $productAccount = $this->getProductAccount($line, $isCustomerInvoice);

                    // Grouper par (compte + taxe) pour conserver fk_tax_id par AML base
                    // Clé composite : même compte avec deux taxes différentes → deux AML distinctes
                    $productKey = $productAccount['id'] . '_' . ($line->fk_tax_id ?? 'null');
                    if (!isset($productLinesGrouped[$productKey])) {
                        $productLinesGrouped[$productKey] = [
                            'account_id' => $productAccount['id'],
                            'code'       => $productAccount['code'],
                            'total'      => 0,
                            'fk_tax_id'  => $line->fk_tax_id ?? null,
                            'tag_status' => 'active', // Sera mis à 'excluded' si taxe on_payment
                        ];
                    }
                    $productLinesGrouped[$productKey]['total'] += abs($line->inl_mtht);

                    /*
                    * =========================
                    * TRAITEMENT DE LA TVA (basé sur account_tax_repartition_line_trl)
                    * Gère TVA normale, autoliquidation et intracommunautaire via trl_factor_percent
                    * =========================
                    */
                    if ($line->fk_tax_id) {
                        $rawTaxRate = TaxTagResolver::resolveTaxRate((int) $line->fk_tax_id);
                        $trlLines   = TaxTagResolver::resolveAllTaxTRLLines((int) $line->fk_tax_id, $documentType);
                        $config     = $this->getAccountConfig();

                        // Régime encaissements + taxe on_payment → compte d'attente
                        $isOnPayment = ($config->aco_vat_regime === 'encaissements')
                            && (TaxTagResolver::resolveTaxExigibility((int) $line->fk_tax_id) === 'on_payment');

                        if ($isOnPayment) {
                            // Tags CA3 différés au règlement : la ligne base HT est taggée 'excluded'
                            // (fk_tax_id conservé pour la comptabilité ; non compté en CA3 jusqu'au règlement)
                            $productLinesGrouped[$productKey]['tag_status'] = 'excluded';
                        }

                        foreach ($trlLines as $trl) {
                            if (!$trl->fk_acc_id) continue;

                            $factor    = (float) ($trl->trl_factor_percent ?? 100);
                            $tvaAmount = abs($line->inl_mtht) * $rawTaxRate / 100 * abs($factor) / 100;

                            // Clé unique par (compte GL TVA + taxe + sens du facteur)
                            $factorSign = $factor >= 0 ? 'pos' : 'neg';

                            if ($isOnPayment) {
                                /*
                                 * TVA sur encaissements :
                                 * On utilise le compte d'attente au lieu du compte TVA définitif.
                                 * fk_tax_id = null → pas de tags CA3 (déclaration différée au paiement).
                                 */
                                $waitingAccId = $isCustomerInvoice
                                    ? $config->fk_acc_id_sale_vat_waiting
                                    : $config->fk_acc_id_purchase_vat_waiting;
                                $waitingAcc = $isCustomerInvoice
                                    ? $config->saleVatWaitingAccount
                                    : $config->purchaseVatWaitingAccount;

                                if (!$waitingAccId) {
                                    throw new \Exception(
                                        "Compte TVA en attente non configuré (régime encaissements). Vérifiez la configuration comptable."
                                    );
                                }

                                // Regrouper toutes les taxes on_payment sur le même compte d'attente
                                $tvaKey = 'waiting_' . $waitingAccId . '_' . $factorSign;
                                if (!isset($taxLinesGrouped[$tvaKey])) {
                                    $taxLinesGrouped[$tvaKey] = [
                                        'account_id' => $waitingAccId,
                                        'code'       => $waitingAcc->acc_code,
                                        'total'      => 0,
                                        'fk_tax_id'  => $line->fk_tax_id,
                                        'reversed'   => $factor < 0,
                                        'tag_status' => 'excluded', // compte d'attente : tags différés au règlement
                                    ];
                                }
                                $taxLinesGrouped[$tvaKey]['total'] += $tvaAmount;
                            } else {
                                // Comportement standard : compte TVA définitif avec tags
                                $tvaKey = $trl->fk_acc_id . '_' . $line->fk_tax_id . '_' . $factorSign;

                                if (!isset($taxLinesGrouped[$tvaKey])) {
                                    $taxLinesGrouped[$tvaKey] = [
                                        'account_id' => $trl->fk_acc_id,
                                        'code'       => $trl->account->acc_code,
                                        'total'      => 0,
                                        'fk_tax_id'  => $line->fk_tax_id,
                                        'reversed'   => $factor < 0, // true = sens inversé par rapport à la base
                                    ];
                                }
                                $taxLinesGrouped[$tvaKey]['total'] += $tvaAmount;
                            }
                        }
                    }
                }

                // Créer les lignes de produits/charges
                foreach ($productLinesGrouped as $data) {
                    // Règle PCG:
                    // - Vente (707): crédit (produit)
                    // - Achat (607): débit (charge)
                    // - Avoirs: inverse
                    $lineDebit = 0;
                    $lineCredit = 0;

                    if ($isCustomerInvoice) {
                        // Vente: crédit du compte 707
                        // Avoir: débit du compte 707 (annulation produit)
                        $lineDebit = $isRefund ? $data['total'] : 0;
                        $lineCredit = $isRefund ? 0 : $data['total'];
                    } else {
                        // Achat: débit du compte 607
                        // Avoir: crédit du compte 607 (annulation charge)
                        $lineDebit = $isRefund ? 0 : $data['total'];
                        $lineCredit = $isRefund ? $data['total'] : 0;
                    }

                    $lines[] = array_merge($commonLineData, [
                        'account_id'      => $data['account_id'],
                        'account_code'    => $data['code'],
                        'debit'           => round($lineDebit, 2),
                        'credit'          => round($lineCredit, 2),
                        'fk_tax_id'       => $data['fk_tax_id'],  // Pour le tagging TVA (base HT)
                        'aml_is_tax_line' => 0,                   // Ligne base HT, pas TVA
                        'tag_status'      => $data['tag_status'],  // 'active' ou 'excluded' (service on_payment)
                    ]);
                }


                // === LIGNES TVA (depuis account_tax_repartition_line_trl) ===
                // Direction normale : customer=crédit, purchase=débit, avoir=inverse
                // trl_factor_percent < 0 inverse le sens (autoliquidation, intracommunautaire)
                foreach ($taxLinesGrouped as $data) {
                    $normalCredit = $isCustomerInvoice ? !$isRefund : $isRefund;
                    $actualCredit = $data['reversed'] ? !$normalCredit : $normalCredit;

                    $lines[] = array_merge($commonLineData, [
                        'account_id'      => $data['account_id'],
                        'account_code'    => $data['code'],
                        'debit'           => $actualCredit ? 0 : round($data['total'], 2),
                        'credit'          => $actualCredit ? round($data['total'], 2) : 0,
                        'fk_tax_id'       => $data['fk_tax_id'],
                        'aml_is_tax_line' => 1,
                        'tag_status'      => $data['tag_status'] ?? 'active', // 'excluded' pour on_payment
                    ]);
                }
            }

            // Correction des écarts d'arrondi (max 0.01€) sur la dernière ligne de détail
            // La ligne tiers (lines[0]) est fixée à inv_totalttc et ne doit pas être modifiée.
            // L'écart provient du fait que round(HT, 2) + round(TVA, 2) ≠ TTC quand HT a 3+ décimales.
            // On ajuste la dernière ligne (TVA en général) pour que débit = crédit.
            $imbalance = round(
                array_sum(array_column($lines, 'debit')) - array_sum(array_column($lines, 'credit')),
                2
            );
            if ($imbalance !== 0.0 && abs($imbalance) <= 0.01) {
                $lastIdx = count($lines) - 1;
                if ($lines[$lastIdx]['credit'] > 0) {
                    $lines[$lastIdx]['credit'] = round($lines[$lastIdx]['credit'] + $imbalance, 2);
                } else {
                    $lines[$lastIdx]['debit'] = round($lines[$lastIdx]['debit'] - $imbalance, 2);
                }
            }

            // Validation de l'équilibre débit/crédit
            $this->validateBalance($lines);

            return [
                'moveLines' => $lines,
            ];
        } catch (\Exception $e) {
            throw new \Exception($e->getMessage());
            // Log l'erreur mais continue avec les autres factures
            //\Log::warning("Erreur lors de l'extraction de la facture {$invoice->inv_id}: " . $e->getMessage());
        }
    }

    /**
     * Construit un mouvement comptable pour un paiement d'acompte
     * Utilise les comptes d'acompte (4191 pour client, 4091 pour fournisseur)
     */
    private function buildMoveFromDepositPayment(PaymentModel $payment): array
    {
        $journal = $this->getJournalForPayment($payment);
        $isCustomerPayment = ($payment->pay_operation == PaymentModel::OPERATION_CUSTOMER_PAYMENT);
        $totalAmount = $payment->allocations->sum('pal_amount');

        $depositInvoice = $payment->depositInvoice;
        if (!$depositInvoice) {
            throw new \Exception("Paiement {$depositInvoice->inv_number} : facture d'acompte introuvable");
        }

        // Récupérer le compte d'acompte (4191 pour client, 4091 pour fournisseur)
        $depositAccount = $this->getDepositAccount($isCustomerPayment);

        // Construire le libellé
        $partnerNames = $payment->allocations->map(function ($allocation) {
            return $allocation->invoice && $allocation->invoice->partner
                ? $allocation->invoice->partner->ptr_name
                : '';
        })->filter()->unique()->implode(', ');

        $moveLabel = "{$depositInvoice->inv_number} - {$partnerNames} - Acompte {$depositInvoice->inv_number}";

        // Données communes
        $commonLineData = [
            'type' => 'pay',
            'move_id' => $payment->pay_id,
            'journal_code' => $journal["code"],
            'journal_id' => $journal["id"],
            'number' => $payment->pay_number,
            'date' => $payment->pay_date->format('Y-m-d'),
            'move_label' => $moveLabel
        ];

        $lines = [];


        // LIGNE 1 : Compte d'acompte (4191 ou 4091) - UNE SEULE LIGNE avec le total        
        if ($isCustomerPayment) {
            // Client : D 4191
            $lines[] = array_merge($commonLineData, [
                'account_id' => $depositAccount['id'],
                'account_code' => $depositAccount['code'],
                'debit' => round($totalAmount, 2),
                'credit' => 0,
            ]);
        } else {
            // Fournisseur : C 4091
            $lines[] = array_merge($commonLineData, [
                'account_id' => $depositAccount['id'],
                'account_code' => $depositAccount['code'],
                'debit' => 0,
                'credit' => round($totalAmount, 2),
            ]);
        }

        // LIGNES 2+ : Comptes partenaires (411 ou 401) - UNE LIGNE PAR ALLOCATION
        foreach ($payment->allocations as $allocation) {
            $invoice = $allocation->invoice;

            if (!$invoice || !$invoice->partner) {
                throw new \Exception("Allocation {$allocation->pal_id} sans facture ou tiers valide");
            }

            $partnerAccount = $this->getPartnerAccount($invoice->partner, $isCustomerPayment);

            if ($isCustomerPayment) {
                // Client : C 411
                $lines[] = array_merge($commonLineData, [
                    'account_id' => $partnerAccount['id'],
                    'account_code' => $partnerAccount['code'],
                    'debit' => 0,
                    'credit' => round($allocation->pal_amount, 2),
                ]);
            } else {
                // Fournisseur : D 401
                $lines[] = array_merge($commonLineData, [
                    'account_id' => $partnerAccount['id'],
                    'account_code' => $partnerAccount['code'],
                    'debit' => round($allocation->pal_amount, 2),
                    'credit' => 0,
                ]);
            }
        }

        $this->validateBalance($lines);

        return ['moveLines' => $lines];
    }

    /**
     * Construit un mouvement comptable pour un paiement de charge
     * Utilise le compte bancaire et les comptes de charges
     */
    private function buildMoveFromChargePayment(PaymentModel $payment): array
    {
        $journal = $this->getJournalForPayment($payment);
        $totalAmount = $payment->pay_amount;

        // Récupérer le compte bancaire
        $bankAccount = $this->getBankAccountForPayment($payment);

        // Construire le libellé
        $chargeLabels = $payment->allocations->map(function ($allocation) {
            return $allocation->charge ? $allocation->charge->che_label : '';
        })->filter()->implode(', ');

        $moveLabel = "{$payment->pay_number} - {$chargeLabels}";

        // Données communes
        $commonLineData = [
            'type' => 'pay',
            'move_id' => $payment->pay_id,
            'journal_code' => $journal["code"],
            'journal_id' => $journal["id"],
            'number' => $payment->pay_number,
            'date' => $payment->pay_date->format('Y-m-d'),
            'move_label' => $moveLabel
        ];

        $lines = [];

        // LIGNE 1 : Compte bancaire (512) - UNE SEULE LIGNE avec le total
        // Charge : toujours C 512 (décaissement)
        $lines[] = array_merge($commonLineData, [
            'account_id' => $bankAccount['id'],
            'account_code' => $bankAccount['code'],
            'debit' => 0,
            'credit' => round($totalAmount, 2),
        ]);

        // LIGNES 2+ : Comptes de charges (depuis charge_type) - GROUPÉES PAR COMPTE COMPTABLE
        // Grouper les allocations par compte comptable
        $chargeAccountsGrouped = [];
        $amountAvailable =  $totalAmount;

        foreach ($payment->allocations as $allocation) {
            $charge = $allocation->charge;

            if (!$charge) {
                throw new \Exception("Allocation {$allocation->pal_id} sans charge valide");
            }

            if (!$charge->type || !$charge->type->account) {
                throw new \Exception("Charge {$charge->che_number} sans type ou compte comptable défini");
            }

            $accountId = $charge->type->account->acc_id;
            $accountCode = $charge->type->account->acc_code;

            // Grouper par compte
            if (!isset($chargeAccountsGrouped[$accountId])) {
                $chargeAccountsGrouped[$accountId] = [
                    'code' => $accountCode,
                    'total' => 0
                ];
            }
            $chargeAccountsGrouped[$accountId]['total'] += $allocation->pal_amount;
            $amountAvailable -= $allocation->pal_amount;
        }

        // Créer une ligne par compte comptable groupé
        foreach ($chargeAccountsGrouped as $accountId => $data) {
            // Charge : D compte de charge
            $lines[] = array_merge($commonLineData, [
                'account_id' => $accountId,
                'account_code' => $data['code'],
                'debit' => round($data['total'], 2),
                'credit' => 0,
            ]);
        }

        //On genere la ligne de reliquat eventuel
        if ($amountAvailable > 0) {
            $lines[] = array_merge($commonLineData, [
                'account_id' =>  $accountId,
                'account_code' => $accountCode,
                'debit' => round($amountAvailable, 2),
                'credit' => 0,
            ]);
        }

        $this->validateBalance($lines);

        return ['moveLines' => $lines];
    }

    /**
     * Construit un mouvement comptable pour un paiement de facture par règlement bancaire
     * Utilise le compte bancaire et les comptes partenaires (411 ou 401)
     */
    private function buildMoveFromInvoicePayment(PaymentModel $payment): array
    {
        $journal = $this->getJournalForPayment($payment);
        $isCustomerPayment = ($payment->pay_operation == PaymentModel::OPERATION_CUSTOMER_PAYMENT);
        $totalAmount = $payment->pay_amount;
        // Récupérer le compte bancaire
        $bankAccount = $this->getBankAccountForPayment($payment);

        // Construire le libellé
        $invoiceNumbers = $payment->allocations->map(function ($allocation) {
            return $allocation->invoice ? $allocation->invoice->inv_number : '';
        })->filter()->implode(', ');

        $partnerNames = $payment->partner->ptr_name;

        $moveLabel = $invoiceNumbers
            ? "{$payment->pay_number} - {$partnerNames} - Facture {$invoiceNumbers}"
            : "{$payment->pay_number} - {$partnerNames}";

        // Données communes
        $commonLineData = [
            'type' => 'pay',
            'move_id' => $payment->pay_id,
            'journal_code' => $journal["code"],
            'journal_id' => $journal["id"],
            'number' => $payment->pay_number,
            'date' => $payment->pay_date->format('Y-m-d'),
            'move_label' => $moveLabel
        ];

        $lines = [];

        $operations = $payment->allocations->map(function ($allocation) {
            return $allocation->invoice ? $allocation->invoice->inv_operation : '';
        })->filter()->unique();

        if ($operations->count() > 1) {

            $customerCombo = collect([
                InvoiceModel::OPERATION_CUSTOMER_INVOICE,
                InvoiceModel::OPERATION_CUSTOMER_DEPOSIT,
            ]);

            $supplierCombo = collect([
                InvoiceModel::OPERATION_SUPPLIER_INVOICE,
                InvoiceModel::OPERATION_SUPPLIER_DEPOSIT,
            ]);

            $isCustomerValid = $customerCombo->diff($operations)->isEmpty();
            $isSupplierValid = $supplierCombo->diff($operations)->isEmpty();

            if (!$isCustomerValid && !$isSupplierValid) {
                throw new \Exception(
                    "Combinaison de types de factures invalide pour ce paiement."
                );
            }
        }

        // $operations peut être vide (règlement sans facture pointée) : pas un avoir
        $firstOperation = $operations->first();
        $isRefund = $firstOperation !== null && in_array($firstOperation, [
            InvoiceModel::OPERATION_CUSTOMER_REFUND,
            InvoiceModel::OPERATION_SUPPLIER_REFUND,
        ]);

        // Compte partenaire initialisé depuis le tiers du paiement lui-même
        // (utilisé pour le reliquat et les règlements sans facture pointée)
        $partnerAccount = null;
        if ($payment->partner) {
            $partnerAccount = $this->getPartnerAccount($payment->partner, $isCustomerPayment);
        }

        // LIGNE 1 : Compte bancaire (512) - UNE SEULE LIGNE avec le total    
        if ($isCustomerPayment) {
            // Client : D 512
            $lines[] = array_merge($commonLineData, [
                'account_id' => $bankAccount['id'],
                'account_code' => $bankAccount['code'],
                'debit' =>  $isRefund ? 0 : round($totalAmount, 2),
                'credit' => $isRefund ?  round($totalAmount, 2) : 0,
            ]);
        } else {
            // Fournisseur : C 512
            $lines[] = array_merge($commonLineData, [
                'account_id' => $bankAccount['id'],
                'account_code' => $bankAccount['code'],
                'debit' =>  $isRefund ? round($totalAmount, 2) : 0,
                'credit' =>  $isRefund ? 0 : round($totalAmount, 2),
            ]);
        }

        $amountAvailable = $totalAmount;
        // LIGNES 2+ : Comptes partenaires (411 ou 401) - UNE LIGNE PAR ALLOCATION
        foreach ($payment->allocations as $allocation) {
            $invoice = $allocation->invoice;

            if (!$invoice || !$invoice->partner) {
                throw new \Exception("Allocation {$allocation->pal_id} sans facture ou tiers valide");
            }

            $partnerAccount = $this->getPartnerAccount($invoice->partner, $isCustomerPayment);

            if ($isCustomerPayment) {
                // Client : C 411
                $lines[] = array_merge($commonLineData, [
                    'account_id' => $partnerAccount['id'],
                    'account_code' => $partnerAccount['code'],
                    'debit' =>  $isRefund ? round($allocation->pal_amount, 2) : 0,
                    'credit' =>  $isRefund ? 0 : round($allocation->pal_amount, 2),
                ]);
            } else {
                // Fournisseur : D 401
                $lines[] = array_merge($commonLineData, [
                    'account_id' => $partnerAccount['id'],
                    'account_code' => $partnerAccount['code'],
                    'debit' => $isRefund ? 0 : round($allocation->pal_amount, 2),
                    'credit' => $isRefund ? round($allocation->pal_amount, 2) : 0,
                ]);
            }
            $amountAvailable -= $allocation->pal_amount;
        }

        // Ligne reliquat (montant non alloué) ou ligne partenaire unique (règlement sans facture pointée)
        if ($amountAvailable > 0.005) {
            if (!$partnerAccount) {
                throw new \Exception("Impossible de générer l'écriture partenaire : aucun tiers associé au paiement {$payment->pay_number}.");
            }
            if ($isCustomerPayment) {
                $lines[] = array_merge($commonLineData, [
                    'account_id' => $partnerAccount['id'],
                    'account_code' => $partnerAccount['code'],
                    'debit' =>  $isRefund ? round($amountAvailable, 2) : 0,
                    'credit' =>  $isRefund ? 0 : round($amountAvailable, 2),
                ]);
            } else {
                $lines[] = array_merge($commonLineData, [
                    'account_id' => $partnerAccount['id'],
                    'account_code' => $partnerAccount['code'],
                    'debit' => $isRefund ? 0 : round($amountAvailable, 2),
                    'credit' => $isRefund ? round($amountAvailable, 2) : 0,
                ]);
            }
        }

        $this->validateBalance($lines);

        // === ÉCRITURES OD TVA SUR ENCAISSEMENTS ===
        // Régime encaissements : pour chaque facture allouée ayant des taxes on_payment,
        // générer une écriture OD qui solde le compte d'attente et crédite le compte TVA définitif.
        // Base HT :
        //   - Paiement total   → activer les tags existants (excluded → active), pas d'OD base HT
        //   - Paiement partiel → exclure les tags existants (excluded → excluded) + OD base HT proratisés
        $odLines         = [];
        $amrStatusUpdates = []; // Instructions de mise à jour amr_status, traitées dans processTransfer
        $config          = $this->getAccountConfig();

        if ($config->aco_vat_regime === 'encaissements' && $config->fk_ajl_id_od && $config->miscJournal) {
            foreach ($payment->allocations as $allocation) {
                $invoice = $allocation->invoice;
                if (!$invoice || $invoice->inv_totalttc == 0) continue;

                $invIsCustomer = in_array($invoice->inv_operation, [
                    InvoiceModel::OPERATION_CUSTOMER_INVOICE,
                    InvoiceModel::OPERATION_CUSTOMER_REFUND,
                    InvoiceModel::OPERATION_CUSTOMER_DEPOSIT,
                ]);
                $invIsRefund = in_array($invoice->inv_operation, [
                    InvoiceModel::OPERATION_CUSTOMER_REFUND,
                    InvoiceModel::OPERATION_SUPPLIER_REFUND,
                ]);
                $invDocType = $invIsCustomer
                    ? ($invIsRefund ? 'out_refund' : 'out_invoice')
                    : ($invIsRefund ? 'in_refund'  : 'in_invoice');

                $vatLines = $this->computeVatOnPaymentLines($invoice, $invDocType);
                if (empty($vatLines)) continue;

                $prorataRatio  = abs($allocation->pal_amount) / abs($invoice->inv_totalttc);

                $waitingAccObj = $invIsCustomer
                    ? $config->saleVatWaitingAccount
                    : $config->purchaseVatWaitingAccount;
                $waitingAccId  = $waitingAccObj?->acc_id;

                if (!$waitingAccId) {
                    throw new \Exception(
                        "Compte TVA en attente non configuré (régime encaissements). Vérifiez la configuration comptable."
                    );
                }

                $odMoveLabel = "TVA encaissements - {$payment->pay_number} / {$invoice->inv_number}";
                $odCommon = [
                    'type'          => 'vat_od',
                    'move_id'       => "{$payment->pay_id}_{$invoice->inv_id}",
                    'pay_id'        => $payment->pay_id,
                    'journal_id'    => $config->fk_ajl_id_od,
                    'journal_code'  => $config->miscJournal->ajl_code,
                    'number'        => $payment->pay_number,
                    'date'          => $payment->pay_date->format('Y-m-d'),
                    'move_label'    => $odMoveLabel,
                    'document_type' => $invDocType,
                ];

                // --- OD TVA + Base HT : un groupe par tax_id ---
                // Structure par groupe (4 lignes) :
                //   [0] Base HT taggée active  (parent, alimente CA3)
                //   [1] Base HT équilibrage    (D=C, fk_tax_id null → aucun tag)
                //   [2] Compte d'attente       (parent_index → [0])
                //   [3] TVA définitive         (parent_index → [0])
                //
                // Les lignes [2] et [3] sont toutes deux enfants de [0] (base HT).
                // parent_index est local à cet OD et transmis explicitement pour ne pas
                // être écrasé par taxParentIndexMap dans processTransfer.

                $baseLines     = $this->computeBaseOnPaymentLines($invoice, $invIsCustomer);
                $normalCredit  = $invIsCustomer ? !$invIsRefund : $invIsRefund;

                // Indexer les vatLines par tax_id pour corrélation avec baseLines
                $vatByTaxId = [];
                foreach ($vatLines as $vatLine) {
                    $vatByTaxId[(int) $vatLine['tax_id']] = $vatLine;
                }

                $odLocalIdx = count($odLines); // position absolue dans $odLines pour ce lot

                foreach ($baseLines as $baseLine) {
                    $baseAmount = round($baseLine['amount'] * $prorataRatio, 2);
                    $vatLine    = $vatByTaxId[(int) $baseLine['tax_id']] ?? null;
                    $mutAmount  = $vatLine ? round($vatLine['amount'] * $prorataRatio, 2) : 0;

                    if ($baseAmount <= 0 && $mutAmount <= 0) continue;

                    // [0] Base HT taggée — ligne parent du groupe
                    $baseTaggedIdx = $odLocalIdx;
                    $odLines[] = array_merge($odCommon, [
                        'account_id'      => $baseLine['acc_id'],
                        'account_code'    => $baseLine['acc_code'],
                        'debit'           => $normalCredit ? 0 : $baseAmount,
                        'credit'          => $normalCredit ? $baseAmount : 0,
                        'fk_tax_id'       => $baseLine['tax_id'],
                        'aml_is_tax_line' => 0,
                        // tag_status = 'active' implicite → alimente CA3
                    ]);
                    $odLocalIdx++;

                    // [1] Base HT équilibrage (D=C, effet comptable nul, aucun tag)
                    $odLines[] = array_merge($odCommon, [
                        'account_id'           => $baseLine['acc_id'],
                        'account_code'         => $baseLine['acc_code'],
                        'debit'                => $normalCredit ? $baseAmount : 0,
                        'credit'               => $normalCredit ? 0 : $baseAmount,
                        'fk_tax_id'            => null,
                        'aml_is_tax_line'      => 0,
                        'prevent_tax_autofill' => true,
                    ]);
                    $odLocalIdx++;

                    if ($vatLine && $mutAmount > 0) {
                        $actualCredit = $vatLine['reversed'] ? !$normalCredit : $normalCredit;

                        // [2] Compte d'attente — enfant de [0]
                        $odLines[] = array_merge($odCommon, [
                            'account_id'      => $waitingAccId,
                            'account_code'    => $waitingAccObj->acc_code,
                            'debit'           => $actualCredit ? $mutAmount : 0,
                            'credit'          => $actualCredit ? 0 : $mutAmount,
                            'fk_tax_id'       => null,
                            'aml_is_tax_line' => 0,
                            'parent_index'    => $baseTaggedIdx,
                        ]);
                        $odLocalIdx++;

                        // [3] TVA définitive — enfant de [0]
                        $odLines[] = array_merge($odCommon, [
                            'account_id'      => $vatLine['acc_id'],
                            'account_code'    => $vatLine['acc_code'],
                            'debit'           => $actualCredit ? 0 : $mutAmount,
                            'credit'          => $actualCredit ? $mutAmount : 0,
                            'fk_tax_id'       => $vatLine['tax_id'],
                            'aml_is_tax_line' => 1,
                            'parent_index'    => $baseTaggedIdx,
                        ]);
                        $odLocalIdx++;
                    }
                }

                // Vatlines orphelines (sans baseLine correspondante) — cas exceptionnel
                foreach ($vatLines as $vatLine) {
                    if (isset($vatByTaxId[(int) $vatLine['tax_id']]) && !empty($baseLines)) continue;
                    $mutAmount    = round($vatLine['amount'] * $prorataRatio, 2);
                    if ($mutAmount <= 0) continue;
                    $actualCredit = $vatLine['reversed'] ? !$normalCredit : $normalCredit;

                    $odLines[] = array_merge($odCommon, [
                        'account_id'      => $waitingAccId,
                        'account_code'    => $waitingAccObj->acc_code,
                        'debit'           => $actualCredit ? $mutAmount : 0,
                        'credit'          => $actualCredit ? 0 : $mutAmount,
                        'fk_tax_id'       => null,
                        'aml_is_tax_line' => 0,
                    ]);
                    $odLocalIdx++;
                    $odLines[] = array_merge($odCommon, [
                        'account_id'      => $vatLine['acc_id'],
                        'account_code'    => $vatLine['acc_code'],
                        'debit'           => $actualCredit ? 0 : $mutAmount,
                        'credit'          => $actualCredit ? $mutAmount : 0,
                        'fk_tax_id'       => $vatLine['tax_id'],
                        'aml_is_tax_line' => 1,
                    ]);
                    $odLocalIdx++;
                }
            }
        }

        return ['moveLines' => $lines, 'odMoveLines' => $odLines, 'amrStatusUpdates' => $amrStatusUpdates];
    }

    /**
     * Calcule les montants TVA on_payment pour une facture donnée.
     * Utilisé lors du transfert d'un règlement en régime encaissements.
     *
     * @return array [['acc_id', 'acc_code', 'tax_id', 'amount', 'reversed'], ...]
     */
    private function computeVatOnPaymentLines(InvoiceModel $invoice, string $documentType): array
    {
        $result = [];

        foreach ($invoice->lines as $line) {
            if ($line->inl_type != 0 || !$line->fk_tax_id) continue;
            if (TaxTagResolver::resolveTaxExigibility((int) $line->fk_tax_id) !== 'on_payment') continue;

            $rawTaxRate = TaxTagResolver::resolveTaxRate((int) $line->fk_tax_id);
            $trlLines   = TaxTagResolver::resolveAllTaxTRLLines((int) $line->fk_tax_id, $documentType);

            foreach ($trlLines as $trl) {
                if (!$trl->fk_acc_id) continue;

                $factor    = (float) ($trl->trl_factor_percent ?? 100);
                $tvaAmount = abs($line->inl_mtht) * $rawTaxRate / 100 * abs($factor) / 100;
                $key       = $trl->fk_acc_id . '_' . $line->fk_tax_id;

                if (!isset($result[$key])) {
                    $result[$key] = [
                        'acc_id'   => $trl->fk_acc_id,
                        'acc_code' => $trl->account->acc_code,
                        'tax_id'   => (int) $line->fk_tax_id,
                        'amount'   => 0,
                        'reversed' => $factor < 0,
                    ];
                }
                $result[$key]['amount'] += $tvaAmount;
            }
        }

        return array_values($result);
    }

    /**
     * Calcule les montants base HT on_payment pour une facture donnée.
     * Retourne le montant HT total par (compte produit × taxe), à proratiser
     * au règlement pour générer les lignes OD base HT taggées active en CA3.
     *
     * @return array [['acc_id', 'acc_code', 'tax_id', 'amount'], ...]
     */
    private function computeBaseOnPaymentLines(
        InvoiceModel $invoice,
        bool $isCustomerInvoice
    ): array {
        $result = [];

        foreach ($invoice->lines as $line) {
            if ($line->inl_type != 0 || !$line->fk_tax_id) continue;
            if (TaxTagResolver::resolveTaxExigibility((int) $line->fk_tax_id) !== 'on_payment') continue;

            $productAccount = $this->getProductAccount($line, $isCustomerInvoice);
            $key = $productAccount['id'] . '_' . $line->fk_tax_id;

            if (!isset($result[$key])) {
                $result[$key] = [
                    'acc_id'   => $productAccount['id'],
                    'acc_code' => $productAccount['code'],
                    'tax_id'   => (int) $line->fk_tax_id,
                    'amount'   => 0,
                ];
            }
            $result[$key]['amount'] += abs($line->inl_mtht);
        }

        return array_values($result);
    }

    /**
     * Construit un mouvement comptable depuis une note de frais approuvée
     * Logique similaire à une facture fournisseur :
     * - Crédit du compte tiers salarié (fk_acc_id_employe)
     * - Débit des comptes de charges 6xx (par catégorie de dépense)
     * - Débit des comptes de TVA déductible (44566)
     */
    private function buildMoveFromExpenseReport(ExpenseReportModel $expenseReport): ?array
    {
        try {
            if (!$expenseReport->user) {
                throw new \Exception("Note de frais {$expenseReport->exr_number} sans salarié associé");
            }

            // Récupérer le compte tiers salarié
            $employeeAccount = $expenseReport->user->employeeAccount;
            if (!$employeeAccount) {
                throw new \Exception(
                    "Aucun compte comptable salarié défini pour l'utilisateur {$expenseReport->user->usr_firstname} {$expenseReport->user->usr_lastname}"
                );
            }

            // Journal d'achat (les notes de frais sont des charges comme les factures fournisseur)
            $config = $this->getAccountConfig();
            if (!$config->purchaseJournal) {
                throw new \Exception('Journal d\'achat non configuré dans account_config_aco');
            }
            $journalId = $config->purchaseJournal->ajl_id;
            $journalCode = $config->purchaseJournal->ajl_code;

            $moveLabel = "Note de frais {$expenseReport->exr_number} - {$expenseReport->user->usr_firstname} {$expenseReport->user->usr_lastname}";

            $commonLineData = [
                'type'          => 'exr',
                'move_id'       => $expenseReport->exr_id,
                'journal_code'  => $journalCode,
                'journal_id'    => $journalId,
                'number'        => $expenseReport->exr_number,
                'date'          => $expenseReport->exr_approval_date->format('Y-m-d'),
                'move_label'    => $moveLabel,
                'document_type' => 'in_invoice', // NDF = toujours des charges fournisseur, jamais un avoir
            ];

            $lines = [];

            // === LIGNE 1 : Compte tiers salarié (crédit TTC - dette envers le salarié) ===
            $lines[] = array_merge($commonLineData, [
                'account_id' => $employeeAccount->acc_id,
                'account_code' => $employeeAccount->acc_code,
                'debit' => 0,
                'credit' => round((float) $expenseReport->exr_total_amount_ttc, 2),
            ]);

            // === LIGNES 2+ : Comptes de charges 6xx (débit HT par catégorie) ===
            $chargeLinesGrouped = [];
            $taxLinesGrouped = [];

            foreach ($expenseReport->expenses as $expense) {
                // Grouper les montants HT par (compte de catégorie + taxe) pour conserver fk_tax_id
                if ($expense->category && $expense->category->account) {
                    $accountId   = $expense->category->account->acc_id;
                    $accountCode = $expense->category->account->acc_code;

                    // Récupérer le fk_tax_id depuis la première ligne de TVA de la dépense
                    $expenseTaxId = $expense->lines->first()?->fk_tax_id ?? null;
                    $chargeKey    = $accountId . '_' . ($expenseTaxId ?? 'null');

                    if (!isset($chargeLinesGrouped[$chargeKey])) {
                        $chargeLinesGrouped[$chargeKey] = [
                            'account_id' => $accountId,
                            'code'       => $accountCode,
                            'total'      => 0,
                            'fk_tax_id'  => $expenseTaxId,
                        ];
                    }
                    $chargeLinesGrouped[$chargeKey]['total'] += (float) $expense->exp_total_amount_ht;
                } else {
                    throw new \Exception(
                        "Dépense sans catégorie ou compte comptable défini dans la note de frais {$expenseReport->exr_number}"
                    );
                }

                // Grouper les montants de TVA par compte de taxe
                foreach ($expense->lines as $line) {
                    if ($line->fk_tax_id && $line->exl_amount_tva > 0) {
                        $taxAccount = $this->getTaxAccount($line->fk_tax_id, 'in_invoice');
                        $taxAccountId = $taxAccount['id'];

                        if (!isset($taxLinesGrouped[$taxAccountId])) {
                            $taxLinesGrouped[$taxAccountId] = [
                                'code'      => $taxAccount['code'],
                                'total'     => 0,
                                'fk_tax_id' => $line->fk_tax_id, // Pour le tagging TVA
                            ];
                        }
                        $taxLinesGrouped[$taxAccountId]['total'] += (float) $line->exl_amount_tva;
                    }
                }
            }

            // === LIGNES frais kilométriques : débit compte configuré dans fk_acc_id_mileage_expense ===
            $mileageTotal = $expenseReport->mileageExpenses()->sum('mex_calculated_amount');
            if ($mileageTotal > 0) {
                if (!$config->mileageExpenseAccount) {
                    throw new \Exception('Compte de charge frais kilométriques non configuré dans account_config_aco (fk_acc_id_mileage_expense)');
                }
                $lines[] = array_merge($commonLineData, [
                    'account_id'   => $config->mileageExpenseAccount->acc_id,
                    'account_code' => $config->mileageExpenseAccount->acc_code,
                    'debit'        => round((float) $mileageTotal, 2),
                    'credit'       => 0,
                ]);
            }

            // Créer les lignes de charges (débit 6xx)
            foreach ($chargeLinesGrouped as $data) {
                $lines[] = array_merge($commonLineData, [
                    'account_id'      => $data['account_id'],
                    'account_code'    => $data['code'],
                    'debit'           => round($data['total'], 2),
                    'credit'          => 0,
                    'fk_tax_id'       => $data['fk_tax_id'],  // Pour le tagging TVA (base HT)
                    'aml_is_tax_line' => 0,                   // Ligne base HT, pas TVA
                ]);
            }

            // Créer les lignes de TVA déductible (débit 44566)
            foreach ($taxLinesGrouped as $taxAccountId => $data) {
                $lines[] = array_merge($commonLineData, [
                    'account_id'      => $taxAccountId,
                    'account_code'    => $data['code'],
                    'debit'           => round($data['total'], 2),
                    'credit'          => 0,
                    'fk_tax_id'       => $data['fk_tax_id'] ?? null, // Tagging TVA
                    'aml_is_tax_line' => 1,                           // Ligne TVA
                ]);
            }

            // Validation de l'équilibre débit/crédit
            $this->validateBalance($lines);

            return [
                'moveLines' => $lines,
            ];
        } catch (\Exception $e) {
            throw new \Exception($e->getMessage());
        }
    }

    /**
     * Construit un mouvement comptable pour un paiement de note de frais
     * Similaire au paiement de charges :
     * - Crédit du compte bancaire (512) pour le décaissement
     * - Débit du compte tiers salarié (fk_acc_id_employe) pour solder la dette
     */
    private function buildMoveFromExpenseReportPayment(PaymentModel $payment): array
    {
        $journal = $this->getJournalForPayment($payment);
        $totalAmount = $payment->pay_amount;

        // Récupérer le compte bancaire
        $bankAccount = $this->getBankAccountForPayment($payment);

        // Construire le libellé
        $expenseReportNumbers = $payment->allocations->map(function ($allocation) {
            return $allocation->expenseReport ? $allocation->expenseReport->exr_number : '';
        })->filter()->implode(', ');

        $employeeNames = $payment->allocations->map(function ($allocation) {
            if ($allocation->expenseReport && $allocation->expenseReport->user) {
                return $allocation->expenseReport->user->usr_firstname . ' ' . $allocation->expenseReport->user->usr_lastname;
            }
            return '';
        })->filter()->unique()->implode(', ');

        $moveLabel = "{$payment->pay_number} - {$employeeNames} - NDF {$expenseReportNumbers}";

        // Données communes
        $commonLineData = [
            'type' => 'pay',
            'move_id' => $payment->pay_id,
            'journal_code' => $journal["code"],
            'journal_id' => $journal["id"],
            'number' => $payment->pay_number,
            'date' => $payment->pay_date->format('Y-m-d'),
            'move_label' => $moveLabel
        ];

        $lines = [];

        // LIGNE 1 : Compte bancaire (512) - Crédit (décaissement)
        $lines[] = array_merge($commonLineData, [
            'account_id' => $bankAccount['id'],
            'account_code' => $bankAccount['code'],
            'debit' => 0,
            'credit' => round($totalAmount, 2),
        ]);

        // LIGNES 2+ : Comptes tiers salariés - GROUPÉS PAR COMPTE COMPTABLE
        $expenseGrouped = [];
        $amountAvailable = $totalAmount;

        foreach ($payment->allocations as $allocation) {
            $expenseReport = $allocation->expenseReport;

            if (!$expenseReport) {
                throw new \Exception("Allocation {$allocation->pal_id} sans note de frais valide");
            }

            if (!$expenseReport->user || !$expenseReport->user->employeeAccount) {
                throw new \Exception(
                    "Note de frais {$expenseReport->exr_number} : aucun compte comptable salarié défini"
                );
            }

            $accountId = $expenseReport->user->employeeAccount->acc_id;
            $accountCode = $expenseReport->user->employeeAccount->acc_code;


            //fk_exr_id            
            if (!isset($expenseGrouped[$allocation->fk_exr_id])) {
                $expenseGrouped[$allocation->fk_exr_id] = [
                    'accountId' => $accountId,
                    'accountCode' => $accountCode,
                    'total' => 0
                ];
            }
            $expenseGrouped[$allocation->fk_exr_id]['total'] += $allocation->pal_amount;
            $amountAvailable -= $allocation->pal_amount;
        }

        // Créer une ligne par compte comptable salarié  groupé (débit = solde de la dette)
        foreach ($expenseGrouped as $key => $data) {
            $lines[] = array_merge($commonLineData, [
                'account_id' => $data['accountId'],
                'account_code' => $data['accountCode'],
                'debit' => round($data['total'], 2),
                'credit' => 0,
            ]);
        }

        // Ligne de reliquat éventuel
        if ($amountAvailable > 0) {
            $lines[] = array_merge($commonLineData, [
                'account_id' => $accountId,
                'account_code' => $accountCode,
                'debit' => round($amountAvailable, 2),
                'credit' => 0,
            ]);
        }

        $this->validateBalance($lines);

        return ['moveLines' => $lines];
    }

    /**
     * Récupère le compte bancaire pour un paiement
     * Utilise soit le compte bancaire des détails du paiement, soit celui par défaut
     */
    private function getBankAccountForPayment(PaymentModel $payment): array
    {
        if ($payment->fk_bts_id && $payment->bankDetails && $payment->bankDetails->account) {
            return [
                'id' => $payment->bankDetails->account->acc_id,
                'code' => $payment->bankDetails->account->acc_code
            ];
        }

        throw new \Exception("Paiement {$payment->pay_number} : compte bancaire introuvable");
    }
    /**
     * Récupère le compte tiers (411 ou 401) avec fallback sur compte par défaut
     */
    private function getPartnerAccount($partner, bool $isCustomer): array
    {
        $accountId = null;
        $accountCode = null;

        if ($isCustomer) {
            // Compte client (411xxx)
            $accountId = $partner->customerAccount->acc_id ?? null;
            $accountCode = $partner->customerAccount->acc_code ?? null;
        } else {
            // Compte fournisseur (401xxx)
            $accountId = $partner->supplierAccount->acc_id ?? null;
            $accountCode = $partner->supplierAccount->acc_code ?? null;
        }

        // Fallback sur compte par défaut de la configuration
        if (!$accountId || !$accountCode) {
            $config = $this->getAccountConfig();

            if ($isCustomer) {
                $accountId = $config->customerAccount->acc_id ?? null;
                $accountCode = $config->customerAccount->acc_code ?? null;
            } else {
                $accountId = $config->supplierAccount->acc_id ?? null;
                $accountCode = $config->supplierAccount->acc_code ?? null;
            }

            if (!$accountId || !$accountCode) {
                throw new \Exception("Aucun compte " . ($isCustomer ? 'client (411)' : 'fournisseur (401)') . " défini");
            }
        }

        return ['id' => $accountId, 'code' => $accountCode];
    }

    /**
     * Récupère le compte de produit/charge (classe 6 ou 7)
     */
    private function getProductAccount($line, bool $isCustomer): array
    {
        $accountId = null;

        if ($isCustomer) {
            // Compte de vente (classe 7)
            $accountId = $line->product->accountSale->acc_id ?? null;
            $accountCode = $line->product->accountSale->acc_code ?? null;
        } else {
            // Compte d'achat (classe 6)
            $accountId = $line->product->accountPurchase->acc_id ?? null;
            $accountCode = $line->product->accountPurchase->acc_code ?? null;
        }

        // Fallback sur compte par défaut
        if (!$accountId) {
            $config = $this->getAccountConfig();
            if ($isCustomer) {
                $accountId = $config->saleAccount->acc_id ?? null;
                $accountCode = $config->saleAccount->acc_code ?? null;
            } else {
                $accountId = $config->purchaseAccount->acc_id ?? null;
                $accountCode = $config->purchaseAccount->acc_code ?? null;
            }
        }

        if (!$accountId) {
            throw new \Exception("Aucun compte de " . ($isCustomer ? 'vente (707)' : 'achat (607)') . " défini");
        }

        return ['id' => $accountId, 'code' => $accountCode];
    }

    /**
     * Récupère le compte d'acompte  (4091 ou 4091)
     */
    private function getDepositAccount(bool $isCustomer): array
    {

        $config = $this->getAccountConfig();
        if ($isCustomer) {
            $accountId = $config->saleDepositAccount->acc_id ?? null;
            $accountCode = $config->saleDepositAccount->acc_code ?? null;
        } else {
            $accountId = $config->purchaseDepositAccount->acc_id ?? null;
            $accountCode = $config->purchaseDepositAccount->acc_code ?? null;
        }

        if (!$accountId) {
            throw new \Exception("Aucun compte de " . ($isCustomer ? ' Acompte (4191)' : 'Acompte (4091)') . " défini");
        }

        return ['id' => $accountId, 'code' => $accountCode];
    }

    /**
     * Récupère le compte GL TVA (445xx) depuis la table de répartition.
     * Remplace l'ancienne lecture de tax_tax.fk_acc_id (champ supprimé).
     * Cache statique via TaxTagResolver.
     */
    private function getTaxAccount(int $taxId, string $documentType = 'in_invoice'): array
    {
        return TaxTagResolver::resolveGLAccount($taxId, $documentType);
    }
    /**
     * Valide l'équilibre débit/crédit d'un mouvement (principe de la partie double)
     */
    private function validateBalance(array $lines): void
    {
        $totalDebit = 0;
        $totalCredit = 0;

        foreach ($lines as $line) {
            $totalDebit += $line['debit'];
            $totalCredit += $line['credit'];
        }

        $difference = abs(round($totalDebit - $totalCredit, 2));

        if ($difference >= 0.01) {
            throw new \Exception("Écriture déséquilibrée: Débit={$totalDebit}, Crédit={$totalCredit}, Différence={$difference}");
        }
    }

    /**
     * Détermine le journal comptable pour une facture
     * Utilise la configuration comptable avec mise en cache
     */
    private function getJournalCodeForInvoice(InvoiceModel $invoice): array
    {
        $config = $this->getAccountConfig();

        // Déterminer le journal selon le type d'opération
        // Note: La configuration stocke les journaux principaux (vente, achat)
        // Les avoirs utilisent les mêmes journaux que les factures normales
        switch ($invoice->inv_operation) {
            case InvoiceModel::OPERATION_CUSTOMER_INVOICE:
            case InvoiceModel::OPERATION_CUSTOMER_DEPOSIT:
            case InvoiceModel::OPERATION_CUSTOMER_REFUND:
                if (!$config->saleJournal) {
                    throw new \Exception('Journal de vente non configuré dans account_config_aco');
                }
                return [
                    "id" => $config->saleJournal->ajl_id,
                    "code" => $config->saleJournal->ajl_code
                ];

            case InvoiceModel::OPERATION_SUPPLIER_INVOICE:
            case InvoiceModel::OPERATION_SUPPLIER_DEPOSIT:
            case InvoiceModel::OPERATION_SUPPLIER_REFUND:
                if (!$config->purchaseJournal) {
                    throw new \Exception('Journal d\'achat non configuré dans account_config_aco');
                }
                return [
                    "id" => $config->purchaseJournal->ajl_id,
                    "code" => $config->purchaseJournal->ajl_code
                ];

            default:
                throw new \Exception('Type de facture non géré: ' . $invoice->inv_operation);
        }
    }

    /**
     * Détermine le journal comptable pour un paiement
     * Utilise la configuration comptable avec mise en cache
     */
    private function getJournalForPayment(PaymentModel $payment): array
    {
        $config = $this->getAccountConfig();

        if ($payment->fk_inv_id_deposit) {
            $journal = $this->getJournalCodeForInvoice($payment->depositInvoice);
            return [
                "id" => $journal["id"],
                "code" => $journal["code"]
            ];
        } else {
            $journal = $config->bankJournal;
        }

        if (!$journal) {
            throw new \Exception('Journal de banque non configuré ');
        }

        return [
            "id" => $journal->ajl_id,
            "code" => $journal->ajl_code
        ];
    }

    /**
     * Traite le transfert comptable des mouvements
     * Utilise saveWithValidation pour garantir l'atomicité et la conformité
     *
     * @param array $movements Liste des mouvements à transférer
     * @param string $startDate Date de début de la période
     * @param string $endDate Date de fin de la période
     * @param int $userId ID de l'utilisateur effectuant le transfert
     * @return AccountTransferModel
     * @throws \Exception
     */
    public function processTransfer(array $movements, string $stardDate, string $endDate, int $userId): AccountTransferModel
    {
        DB::beginTransaction();

        try {

            $movedCount = 0;

            $accountMovesData      = [];
            $amrUpdateInstructions = []; // Instructions amr_update séparées des mouvements comptables
            $createdAmoIds         = []; // [key => amo_id] pour la liaison pay↔vat_od
            $invIds = [];
            $payIds = [];
            $exrIds = [];

            foreach ($movements as $movement) {
                // Filtrer les instructions de mise à jour AMR (pas des écritures comptables)
                if ($movement['type'] === 'amr_update') {
                    $amrUpdateInstructions[] = $movement;
                    continue;
                }

                // Valider la période de saisie
                $key = $movement["type"] . "_" . $movement["move_id"];
                if (!isset($accountMovesData[$key])) {
                    $accountMovesData[$key] = [
                        'fk_ajl_id'     => $movement['journal_id'],
                        'amo_date'      => $movement['date'],
                        'amo_label'     => $movement['move_label'],
                        'amo_ref'       => $movement['number'],
                        'document_type' => $movement['document_type'] ?? 'in_invoice',
                        'fk_inv_id' => $movement['type'] === 'inv' ? $movement['move_id'] : null,
                        'fk_pay_id' => match ($movement['type']) {
                            'pay'    => $movement['move_id'],
                            'vat_od' => $movement['pay_id'],
                            default  => null,
                        },
                        'fk_exr_id' => $movement['type'] === 'exr' ? $movement['move_id'] : null,
                        'fk_usr_id_author' => $userId,
                    ];
                }

                $line = [
                    "fk_acc_id"              => $movement["account_id"],
                    "aml_label_entry"        => $movement["move_label"],
                    "aml_ref"                => $movement["number"],
                    "aml_date"               => $movement["date"],
                    "aml_debit"              => $movement["debit"],
                    "aml_credit"             => $movement["credit"],
                    "fk_tax_id"              => $movement["fk_tax_id"] ?? null,       // Tagging TVA
                    "aml_is_tax_line"        => $movement["aml_is_tax_line"] ?? 0,    // Tagging TVA
                    "tag_status"             => $movement["tag_status"] ?? 'active',   // Statut tag CA3
                    "prevent_tax_autofill"   => $movement["prevent_tax_autofill"] ?? false, // Empêche l'auto-remplissage fk_tax_id
                ];
                // Propager parent_index s'il est défini explicitement dans le mouvement
                // (ex: OD TVA encaissements — lie la ligne TVA à son compte d'attente).
                // On utilise array_key_exists et non ?? pour distinguer null explicite de "absent"
                // → resolvedLines verra array_key_exists('parent_index', $l) = true et
                //   n'écrasera pas avec taxParentIndexMap.
                if (array_key_exists('parent_index', $movement)) {
                    $line['parent_index'] = $movement['parent_index'];
                }
                $accountMovesData[$key]['moveLines'][] = $line;
            }


            foreach ($accountMovesData as $key => $accountMoveData) {
                try {
                    // Préparer les données de l'en-tête (sans moveLines)
                    $moveData = [
                        'fk_ajl_id'          => $accountMoveData['fk_ajl_id'],
                        'amo_date'           => $accountMoveData['amo_date'],
                        'amo_label'          => $accountMoveData['amo_label'],
                        'amo_ref'            => $accountMoveData['amo_ref'],
                        'amo_document_type'  => $accountMoveData['document_type'] ?? 'in_invoice',
                        'fk_inv_id'          => $accountMoveData['fk_inv_id'],
                        'fk_pay_id'          => $accountMoveData['fk_pay_id'],
                        'fk_exr_id'          => $accountMoveData['fk_exr_id'],
                        'fk_usr_id_author'   => $accountMoveData['fk_usr_id_author'],
                        'amo_amount'         => 0, // Sera calculé automatiquement
                    ];
                    // Résolution des parent_index : chaque ligne TVA reçoit l'index de sa ligne base HT
                    // (première ligne avec le même fk_tax_id et aml_is_tax_line = 0)
                    $taxParentIndexMap = [];
                    foreach ($accountMoveData['moveLines'] as $idx => $l) {
                        if (empty($l['aml_is_tax_line']) && !empty($l['fk_tax_id'])) {
                            $taxId = (int) $l['fk_tax_id'];
                            if (!isset($taxParentIndexMap[$taxId])) {
                                $taxParentIndexMap[$taxId] = $idx;
                            }
                        }
                    }
                    $resolvedLines = array_map(function ($l) use ($taxParentIndexMap) {
                        // Ne résoudre via taxParentIndexMap que si parent_index n'est pas déjà
                        // positionné explicitement par le constructeur (ex : OD TVA encaissements).
                        if (
                            !empty($l['aml_is_tax_line']) && !empty($l['fk_tax_id'])
                            && !array_key_exists('parent_index', $l)
                        ) {
                            $l['parent_index'] = $taxParentIndexMap[(int) $l['fk_tax_id']] ?? null;
                        }
                        return $l;
                    }, $accountMoveData['moveLines']);

                    // ✨ CRÉATION ATOMIQUE avec toutes les validations
                    // Cette méthode gère :
                    // - La transaction interne (imbriquée dans la transaction globale)
                    // - La création de l'écriture + lignes
                    // - validateMinimumLines()
                    // - validateBalance()
                    // - validateWritingPeriod()
                    $savedMove = AccountMoveModel::saveWithValidation(
                        moveData: $moveData,
                        linesData: $resolvedLines,
                        moveId: null // null = création
                    );

                    // Tracker l'amo_id créé pour la liaison pay↔vat_od
                    $createdAmoIds[$key] = $savedMove->amo_id;

                    // Les tags TVA sont apposés automatiquement via AccountMoveLineModel::created().
                    $movedCount++;

                    $keyExplode = explode('_', $key);
                    if ($keyExplode[0] === 'inv') {
                        $invIds[] = $keyExplode[1];
                    } elseif ($keyExplode[0] === 'pay') {
                        $payIds[] = $keyExplode[1];
                    } elseif ($keyExplode[0] === 'exr') {
                        $exrIds[] = $keyExplode[1];
                    }
                } catch (\Exception $e) {
                    // Enrichir l'exception avec le contexte
                    throw new \Exception(
                        "Erreur lors du transfert du mouvement {$key}: " . $e->getMessage()
                    );
                }
            }

            // === Mise à jour amr_status (tags CA3 base HT on_payment) ===
            // Exécutée après tous les saveWithValidation pour garantir que les AML de facture
            // existent (qu'elles aient été créées dans ce batch ou dans un batch précédent).
            /*$this->applyAmrStatusUpdates($amrUpdateInstructions);*/

            // === Liaison pay↔vat_od (fk_amo_id_parent) ===
            // Key format vat_od : "vat_od_{pay_id}_{inv_id}"
            // Key format pay    : "pay_{pay_id}"
            foreach ($createdAmoIds as $key => $amoId) {
                if (!str_starts_with($key, 'vat_od_')) continue;

                // Extraire le pay_id depuis la key vat_od_{pay_id}_{inv_id}
                $parts  = explode('_', $key, 4); // ['vat', 'od', '{pay_id}', '{inv_id}']
                $payId  = $parts[2] ?? null;
                $parentKey = "pay_{$payId}";

                if ($payId && isset($createdAmoIds[$parentKey])) {
                    \App\Models\AccountMoveModel::where('amo_id', $amoId)
                        ->update(['fk_amo_id_parent' => $createdAmoIds[$parentKey]]);
                }
            }

            // Mettre à jour les statuts source
            $this->updateSourceStatus($invIds, $payIds, $exrIds, $stardDate, $endDate);

            // Créer l'enregistrement de transfert
            $transfer = AccountTransferModel::create([
                'atr_transfer_start' => $stardDate,
                'atr_transfer_end' => $endDate,
                'atr_moves' => json_encode($movements),
                'atr_moves_number' => $movedCount,
                'fk_usr_id_author' => $userId,
            ]);

            DB::commit();

            // Lancer le lettrage automatique
            $AccountLetteringService = new AccountLetteringService();
            $AccountLetteringService->autoLettering();

            return $transfer;
        } catch (\Exception $e) {
            DB::rollBack();
            throw new \Exception('Exception processTransfer : ' . $e->getMessage());
        }
    }

    /**
     * Applique les instructions de mise à jour amr_status sur les tags CA3 base HT on_payment.
     *
     * Deux actions possibles transmises par buildMoveFromInvoicePayment :
     *  - 'activate' : paiement total → excluded → active (les tags existants deviennent déclarables)
     *  - 'exclude'  : paiement partiel → excluded → excluded (remplacés par les OD proratisés)
     *
     * La recherche des lignes AML cibles passe par la facture (fk_inv_id sur amo) pour être
     * robuste que la facture soit comptabilisée dans ce batch ou dans un batch précédent.
     */
 /*   private function applyAmrStatusUpdates(array $instructions): void
    {
        if (empty($instructions)) return;

        foreach ($instructions as $instruction) {
            $invId   = $instruction['inv_id'];
            $action  = $instruction['action'];   // 'activate' | 'exclude'
            $taxIds  = $instruction['tax_ids'];   // int[]

            $newStatus = $action === 'activate' ? 'active' : 'excluded';

            // Trouver les AML base HT (aml_is_tax_line = 0) de la facture
            // dont les tags AMR sont encore 'excluded' pour les taxes concernées.
            $amlIds = DB::table('account_move_line_aml as aml')
                ->join('account_move_amo as amo', 'aml.fk_amo_id', '=', 'amo.amo_id')
                ->where('amo.fk_inv_id', $invId)
                ->where('aml.aml_is_tax_line', 0)
                ->whereIn('aml.fk_tax_id', $taxIds)
                ->pluck('aml.aml_id')
                ->all();

            if (empty($amlIds)) continue;

            DB::table('account_move_line_tag_rel_amr')
                ->whereIn('fk_aml_id', $amlIds)
                ->where('amr_status', 'excluded')
                ->update(['amr_status' => $newStatus]);
        }
    }*/

    /**
     * Met à jour le statut de la source (facture, paiement ou note de frais)
     */
    private function updateSourceStatus(array $invIds, array $payIds, array $exrIds, string $startDate, string $endDate): void
    {

        InvoiceModel::whereIn('inv_id', $invIds)
            ->update(['inv_status' => InvoiceModel::STATUS_ACCOUNTED]);

        PaymentModel::whereIn('pay_id',  $payIds)
            ->update(['pay_status' => PaymentModel::STATUS_ACCOUNTED]);

        // Marquer les factures d'acompte comme comptabilisées
        InvoiceModel::from('invoice_inv as inv')
            ->join('payment_allocation_pal as pal', 'inv.inv_id', '=', 'pal.fk_inv_id')
            ->join('payment_pay as pay', 'pal.fk_pay_id', '=', 'pay.pay_id')
            ->whereIn('pay.pay_id', $payIds)
            ->whereIn('inv.inv_operation', [InvoiceModel::OPERATION_CUSTOMER_DEPOSIT, InvoiceModel::OPERATION_SUPPLIER_DEPOSIT,])
            ->where('inv.inv_status', InvoiceModel::STATUS_FINALIZED)
            ->update(['inv.inv_status' => InvoiceModel::STATUS_ACCOUNTED]);

        // Marque les paiements par avoir comme exportés
        PaymentModel::whereIn('pay_status', [PaymentModel::STATUS_DRAFT])
            ->whereBetween('pay_date', [$startDate, $endDate])
            ->whereNotNull('fk_inv_id_refund')
            ->whereNull('fk_inv_id_deposit')
            ->update(['pay_status' => PaymentModel::STATUS_ACCOUNTED]);

        // Marquer les notes de frais comme comptabilisées
        if (!empty($exrIds)) {
            ExpenseReportModel::whereIn('exr_id', $exrIds)
                ->update(['exr_status' => 'accounted']);
        }
    }
}
