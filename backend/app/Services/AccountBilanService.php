<?php

namespace App\Services;

use App\Models\AccountConfigModel;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AccountBilanService
{
    protected $balanceSheetData;
    protected $accCodeLength;

    public function generateBilan($filters)
    {
        $accountConfig = AccountConfigModel::find(1);

        $this->accCodeLength = $accountConfig->aco_account_length;
        $this->getBalanceSheetConfiguration();

        // Données année N
        $this->loadBilanData(
            $filters['aml_date_start'],
            $filters['aml_date_end']
        );

        // Données année N-1
        $this->loadBilanDataN1($filters);

        return $this->balanceSheetData;
    }

    private function getBalanceSheetConfiguration()
    {
        $this->balanceSheetData = [
            'actif' => [
                'actif_immobilise' => [
                    'label' => 'Actif immobilisé :',
                    'content' => [
                        'immo_incorp_fonds_commercial' => [
                            'label' => 'Immo. incorp. fonds commercial',
                            'codes' => [
                                'brut' => [['206', '207']],
                                'amort' => [['2806', '2807'], ['2906', '2907']]
                            ]
                        ],
                        'immo_incorp_autre' => [
                            'label' => 'Immo. incorp. autres',
                            'codes' => [
                                'brut' => [['200', '205'], ['208', '209'], ['232', '237']],
                                'amort' => [['280', '290'], ['2932', '2932']]
                            ]
                        ],
                        'immo_corp' => [
                            'label' => 'Immobilisations Corporelles',
                            'codes' => [
                                'brut' => [['21', '231'], ['238', '259']],
                                'amort' => [['281', '289'], ['291', '2931'], ['294', '295']]
                            ]
                        ],
                        'immo_financieres' => [
                            'label' => 'Immobilisations Financières',
                            'codes' => [
                                'brut' => [['260', '268'], ['270', '278']],
                                'amort' => [['296', '299']]
                            ]
                        ]
                    ]
                ],
                'actif_circulant' => [
                    'label' => 'Actif circulant :',
                    'content' => [
                        'actif_circulant_stocks' => [
                            'label' => "Stocks et en-cours",
                            'codes' => [
                                'brut' => [['30', '36']],
                                'amort' => [['390', '396']]
                            ]
                        ],
                        'actif_circulant_marchandises' => [
                            'label' => 'Marchandises',
                            'codes' => [
                                'brut' => [['37', '38']],
                                'amort' => [['397', '399']]
                            ]
                        ],
                        'actif_circulant_avances' => [
                            'label' => 'Avances et acomptes sur cdes',
                            'codes' => [
                                'brut' => [['4090', '4095']]
                            ]
                        ]
                    ]
                ],
                'creances' => [
                    'label' => 'Créances :',
                    'content' => [
                        'creance_clients' => [
                            'label' => 'Clients et comptes rattachés',
                            'codes' => [
                                'brut' => [['410', '418', 'D']],
                                'amort' => [['490', '494']]
                            ]
                        ],
                        'creance_autres' => [
                            'label' => 'Autres',
                            'codes' => [
                                'brut' => [['400', '408', 'D'], ['4096', '4099'], ['420', '425', 'D'], ['4287', '4299'], ['430', '453', 'D'], ['455', '459', 'D'], ['460', '463'], ['465', '466'], ['467', '467', 'D'], ['4687', '4699'], ['470', '476', 'D'], ['478', '479', 'D'], ['480', '485'], ['169', '169']],
                                'amort' => [['495', '499']]
                            ]
                        ]
                    ]
                ],
                'valeur_mobilieres' => [
                    'label' => 'Valeurs mobilières de placement',
                    'codes' => [
                        'brut' => [['500', '508'], ['59', '59']]
                    ]
                ],
                'disponibilites' => [
                    'label' => 'Disponibilités (autres que caisse)',
                    'codes' => [
                        'brut' => [['510', '511'], ['512', '514', 'D'], ['515', '516'], ['517', '517', 'D'], ['5187', '5189'], ['52', '52', 'D'], ['54', '58']]
                    ]
                ],
                'caisse' => [
                    'label' => 'Caisse',
                    'codes' => [
                        'brut' => [['53', '53']]
                    ]
                ],
                'charges_constatees_avance' => [
                    'label' => "Charges constatées d'avance (III)",
                    'codes' => [
                        'brut' => [['486', '486']]
                    ]
                ]
            ],
            'passif' => [
                'capitaux_propres' => [
                    'label' => 'Capitaux propres :',
                    'content' => [
                        'capital' => [
                            'label' => 'Capital',
                            'codes' => [
                                'amort' => [['100', '103'], ['108', '109']],
                            ]
                        ],
                        'ecart' => [
                            'label' => 'Ecarts de réévaluation',
                            'codes' => [
                                'amort' => [['105', '1005']],
                            ]
                        ],
                        'reserve_legale' => [
                            'label' => 'Réserve légale',
                            'codes' => [
                                'amort' => [['1060', '1061']],
                            ]
                        ],
                        'reserve_regl' => [
                            'label' => 'Réserves réglementées',
                            'codes' => [
                                'amort' => [['1062', '1062'], ['1064', '1067']],
                            ]
                        ],
                        'reserve_autre' => [
                            'label' => 'Autres reserves',
                            'codes' => [
                                'amort' => [['104', '104'], ['1063', '1063'], ['1068', '1079']],
                            ]
                        ]
                    ]
                ],
                'report_nouveau' => [
                    'label' => 'Report à nouveau',
                    'codes' => [
                        'amort' => [['11', '11']]
                    ]
                ],
                'resultat' => [
                    'label' => "Résultat de l'exercice (bénéfice ou perte)",
                    'codes' => [
                        'amort' => [['7', '7'], ['6', '6'], ['12', '12']]
                    ]
                ],
                'provision' => [
                    'label' => 'Provisions réglementées',
                    'codes' => [
                        'amort' => [['13', '14']]
                    ]
                ],
                'provision_risque' => [
                    'label' => 'Provisions pour risques et charges (II)',
                    'codes' => [
                        'amort' => [['15', '15']]
                    ]
                ],
                'dettes' => [
                    'label' => 'Dettes :',
                    'content' => [
                        'emprunts' => [
                            'label' => 'Emprunts et dettes assimilées',
                            'codes' => [
                                'brut' => [['512', '514', 'C'], ['517', '517', 'C']],
                                'amort' => [['160', '168'], ['17', '19'], ['5180', '5186'], ['519', '519']],
                            ]
                        ],
                        'avance' => [
                            'label' => 'Avances et acomptes reçus sur cde',
                            'codes' => [
                                'amort' => [['4190', '4195']],
                            ]
                        ],
                        'fournisseur' => [
                            'label' => 'Fournisseurs et comptes rattachés',
                            'codes' => [
                                'brut' => [['400', '403', 'C'], ['408', '408', 'C']],
                                'amort' => [['4084', '4087', 'C']],
                            ]
                        ],
                        'dette_autres' => [
                            'label' => 'Autres',
                            'codes' => [
                                'brut' => [['420', '425', 'C'], ['404', '407', 'C'], ['4084', '4087', 'C'], ['410', '418', 'C'], ['430', '449', 'C'], ['450', '453', 'C'], ['455', '457', 'C'], ['458', '459', 'C'], ['467', '467', 'C'], ['470', '476', 'C'], ['478', '479', 'C'], ['52', '52', 'C']],
                                'amort' => [['269', '269'], ['279', '279'], ['4196', '4199'], ['4260', '4286'], ['454', '454'], ['464', '464'], ['4680', '4686'], ['477', '477'], ['509', '509']],
                            ]
                        ]
                    ]
                ],
                'produit_avance' => [
                    'label' => "Produits constatés d'avance (IV)",
                    'codes' => [
                        'brut' => [['487', '489']]
                    ]
                ]
            ]
        ];
    }
    /**
     * Complète le tableau de configuration du bilan avec les sommes comptables
     * @param string $dateStart Date de début
     * @param string $dateEnd Date de fin
     * @return array Configuration du bilan avec les montants calculés
     */
    private function loadBilanData($dateStart, $dateEnd, $periode = '')
    {
        $accountBalancesRs = DB::table('account_move_line_aml as aml')
            ->join('account_account_acc as acc', 'aml.fk_acc_id', 'acc.acc_id')
            ->whereBetween('aml.aml_date', [$dateStart, $dateEnd])
            ->groupBy('acc.acc_code')
            ->orderBy('acc.acc_code')
            ->get([
                'acc.acc_code',
                DB::raw('SUM(COALESCE(aml_debit, 0)) as debit'),
                DB::raw('SUM(COALESCE(aml_credit, 0)) as credit'),
                DB::raw('SUM(COALESCE(aml_debit, 0) - COALESCE(aml_credit, 0)) as solde')
            ])
            // ->keyBy('acc_code')
            //->map(fn($row) => ['s' => $row->solde, 'd' => $row->debit, 'c' => $row->credit])
            ->toArray();

        // Indexation des résultats par code de compte pour un accès O(1)       
        $accountBalances = [];
        foreach ($accountBalancesRs as $row) {
            // $accountBalances[$row['acc_code']] = ["s" => $row['solde'], "d" => $row['debit'], "c" => $row['credit']];
            $accountBalances[$row->acc_code] = ['s' => $row->solde, 'd' => $row->debit, 'c' => $row->credit];
        }


        // Calcul des montants pour chaque section
        $this->calculateBalanceSheetAmounts($this->balanceSheetData['actif'], $accountBalances, $periode);
        $this->calculateBalanceSheetAmounts($this->balanceSheetData['passif'], $accountBalances, $periode);
    }
    /**
     * Génère les données du bilan pour l'exercice N-1
     */
    private function loadBilanDataN1($filters)
    {
        $dateStart = Carbon::parse($filters['aml_date_start'])->subYear()->format('Y-m-d');
        $dateEnd = Carbon::parse($filters['aml_date_end'])->subYear()->format('Y-m-d');

        $this->loadBilanData($dateStart, $dateEnd, 'N1');
    }
    /**
     * Calcule récursivement les montants pour chaque section du bilan
     * @param array &$section Section du bilan à traiter
     * @param array $accountBalances Soldes des comptes indexés par code
     */
    private function calculateBalanceSheetAmounts(&$section, &$accountBalances, $periode)
    {
        foreach ($section as &$item) {
            if (isset($item['content'])) {
                // Section avec sous-éléments : calcul récursif
                $this->calculateBalanceSheetAmounts($item['content'], $accountBalances, $periode);
            } elseif (isset($item['codes'])) {
                // Élément final : calcul des montants
                $brut = $this->calculateAmount($item['codes']['brut'] ?? [], $accountBalances);
                $amort = $this->calculateAmount($item['codes']['amort'] ?? [], $accountBalances);
                $net = $brut - $amort;

                if ($periode == '') {
                    $item['brut_amount'] = $brut;
                    $item['amort_amount'] = $amort;
                    $item['net_amount'] = $net;
                } else {
                    $item['net_amount_N1'] = $net;
                }
            }
        }
    }
    /**
     * Calcule le montant total pour une liste de plages de comptes
     * @param array $codeRanges Plages de codes de comptes [[debut, fin], ...]
     * @param array $accountBalances Soldes des comptes
     * @return float Montant total
     */
    private function calculateAmount($codeRanges, &$accountBalances)
    {
        $total = 0;

        foreach ($codeRanges as $range) {
            $sens = $range[2] ?? 's';
            $total += $this->filterAccounts($accountBalances, $range[0], $range[1], $sens);
        }
        return $total;
    }

    /**
     * Filtre et extrait les lignes de $accountBalances entre $start et $end inclus,
     * puis supprime ces lignes du tableau source.
     *
     * @param array &$accountBalances Tableau de comptes [acc_code => balance].
     * @param string $start Borne de début (ex: '261').
     * @param string $end Borne de fin (ex: '262').
     
     * @return array Lignes extraites [acc_code => balance].
     */
    function filterAccounts(array &$accountBalances, string $start, string $end, string $sens): float
    {
        // Normalisation des bornes
        $startAdjusted = str_pad($start, $this->accCodeLength, '0', STR_PAD_RIGHT);
        $endAdjusted = str_pad($end, $this->accCodeLength, '9', STR_PAD_RIGHT);

        $totalAmount = 0;

        foreach ($accountBalances as $acc_code => $balance) {
            $acc_code_str = str_pad((string)$acc_code, $this->accCodeLength, '0', STR_PAD_LEFT);

            if ($acc_code_str >= $startAdjusted && $acc_code_str <= $endAdjusted) {
                if (strtolower($sens) == "s") {
                    $totalAmount += $balance["s"];
                } elseif (strtolower($sens) == "d") {
                    $diff = $balance['d'] - $balance['c'];
                    $totalAmount += $diff > 0 ?  $diff : 0;
                } else {
                    $diff = $balance['c'] - $balance['d'];
                    $totalAmount += $diff > 0 ?  $diff : 0;
                }
            }
        }

        return $totalAmount;
    }
}
