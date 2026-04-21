<?php

namespace App\Services;

use App\Models\MessageTemplateModel;
use App\Models\CompanyModel;
use App\Models\TicketModel;
use App\Models\SaleOrderModel;
use App\Models\InvoiceModel;


class TemplateParserService
{
    /**
     * Construit les données de contexte pour le parser de templates.
     *
     * @param string $context  'ticket' | 'sale' | 'invoice'
     * @param int    $documentId  ID du ticket / commande / facture
     * @param mixed  $extra  Pour 'ticket' : l'article courant (TicketArticleModel)
     */
    public static function buildData(string $context, int $documentId, $extra = null): array
    {
        $data = [];

        // Utilisateur connecté
        $user = auth()->user();
        if ($user) {
            $data['user'] = [
                'id'        => $user->usr_id,
                'firstname' => $user->usr_firstname ?? '',
                'lastname'  => $user->usr_lastname  ?? '',
                'fullname'  => trim(($user->usr_firstname ?? '') . ' ' . ($user->usr_lastname ?? '')),
                'email'     => $user->usr_login     ?? '',
                'phone'     => $user->usr_tel        ?? '',
                'mobile'    => $user->usr_mobile     ?? '',
                'job_title' => $user->usr_jobtitle  ?? '',
            ];
        }

        // Entreprise
        $company = CompanyModel::first();
        if ($company) {
            $logoBase64 = null;
            if ($company->fk_doc_id_logo_printable) {
                $logoData   = DocumentService::getOnBase64($company->fk_doc_id_logo_printable);
                $logoBase64 = $logoData['base64'] ?? null;
            }
            $data['company'] = [
                'name'              => $company->cop_label             ?? '',
                'address'           => $company->cop_address           ?? '',
                'zip'               => $company->cop_zip               ?? '',
                'city'              => $company->cop_city              ?? '',
                'phone'             => $company->cop_phone             ?? '',
                'email'             => $company->cop_email             ?? '',
                'tva_code'          => $company->cop_tva_code          ?? '',
                'registration_code' => $company->cop_registration_code ?? '',
                'legal_status'      => $company->cop_legal_status      ?? '',
                'capital'           => $company->cop_capital           ?? '',
                'rcs'               => $company->cop_rcs               ?? '',
                'url_site'          => $company->cop_url_site          ?? '',
                'mail_parser'       => $company->cop_mail_parser       ?? '',
                'logo'              => $logoBase64,
            ];
        }

        if ($context === 'ticket') {
            $ticket = TicketModel::with(['openBy', 'openTo', 'partner', 'assignedTo', 'author'])
                ->find($documentId);

            if ($ticket) {
                $openedBy = '';
                if ($ticket->openBy) {
                    $openedBy = trim(($ticket->openBy->ctc_firstname ?? '') . ' ' . ($ticket->openBy->ctc_lastname ?? ''));
                } elseif ($ticket->author) {
                    $openedBy = trim(($ticket->author->usr_firstname ?? '') . ' ' . ($ticket->author->usr_lastname ?? ''));
                }

                $assignedTo = '';
                if ($ticket->assignedTo) {
                    $assignedTo = trim(($ticket->assignedTo->usr_firstname ?? '') . ' ' . ($ticket->assignedTo->usr_lastname ?? ''));
                }

                $data['ticket'] = [
                    'id'          => $ticket->tkt_id,
                    'ref'         => $ticket->tkt_ref      ?? '',
                    'label'       => $ticket->tkt_label    ?? '',
                    'opened_at'   => $ticket->tkt_opendate ? \Carbon\Carbon::parse($ticket->tkt_opendate)->format('d/m/Y') : '',
                    'opened_by'   => $openedBy,
                    'assigned_to' => $assignedTo,
                ];

                if ($ticket->openTo) {
                    $contact = $ticket->openTo;
                    $data['contact'] = [
                        'id'        => $contact->ctc_id,
                        'firstname' => $contact->ctc_firstname ?? '',
                        'lastname'  => $contact->ctc_lastname  ?? '',
                        'fullname'  => trim(($contact->ctc_firstname ?? '') . ' ' . ($contact->ctc_lastname ?? '')),
                        'email'     => $contact->ctc_email    ?? '',
                        'phone'     => $contact->ctc_phone      ?? '',
                        'mobile'    => $contact->ctc_mobile   ?? '',
                        'jobtitle'  => $contact->ctc_job_title ?? '',
                    ];
                }

                if ($ticket->partner) {
                    $data['partner'] = [
                        'name' => $ticket->partner->ptr_name ?? '',
                    ];
                }

                // Article courant (last_message)
                if ($extra) {
                    $data['last_message'] = [
                        'date' => $extra->tka_date
                            ? \Carbon\Carbon::parse($extra->tka_date)->format('d/m/Y H:i')
                            : '',
                        'body' => $extra->tka_message ?? '',
                    ];
                }
            }

        } elseif ($context === 'sale') {
            $document = SaleOrderModel::with(['partner', 'contact', 'lines', 'seller'])->find($documentId);
            if ($document) {
                $data['order'] = [
                    'id'        => $document->ord_id,
                    'number'    => $document->ord_number   ?? '',
                    'date'      => $document->ord_date     ? $document->ord_date->format('d/m/Y')  : '',
                    'valid'     => $document->ord_valid    ? $document->ord_valid->format('d/m/Y') : '',
                    'total_ht'  => number_format($document->ord_totalht  ?? 0, 2, ',', ' '),
                    'total_tax' => number_format($document->ord_totaltax ?? 0, 2, ',', ' '),
                    'total_ttc' => number_format($document->ord_totalttc ?? 0, 2, ',', ' '),
                    'note'      => $document->ord_note ?? '',
                    'ref'       => $document->ord_ref  ?? '',
                ];
                if ($document->partner) {
                    $p = $document->partner;
                    $data['partner'] = [
                        'id'      => $p->ptr_id,      'name'    => $p->ptr_name    ?? '',
                        'email'   => $p->ptr_email    ?? '',  'phone'   => $p->ptr_phone   ?? '',
                        'mobile'  => $p->ptr_mobile   ?? '',  'address' => $p->ptr_address ?? '',
                        'zip'     => $p->ptr_zip      ?? '',  'city'    => $p->ptr_city    ?? '',
                        'country' => $p->ptr_country  ?? '',  'tva_code'=> $p->ptr_tva_code ?? '',
                        'siret'   => $p->ptr_siret    ?? '',
                    ];
                }
                if ($document->contact) {
                    $c = $document->contact;
                    $data['contact'] = [
                        'id'        => $c->ctc_id,
                        'firstname' => $c->ctc_firstname ?? '', 'lastname'  => $c->ctc_lastname  ?? '',
                        'email'     => $c->ctc_email     ?? '', 'phone'     => $c->ctc_phone     ?? '',
                        'mobile'    => $c->ctc_mobile    ?? '', 'jobtitle'  => $c->ctc_job_title ?? '',
                        'fullname'  => trim(($c->ctc_firstname ?? '') . ' ' . ($c->ctc_lastname ?? '')),
                    ];
                }
                if ($document->seller) {
                    $s = $document->seller;
                    $data['seller'] = [
                        'id' => $s->usr_id, 'firstname' => $s->usr_firstname ?? '',
                        'lastname' => $s->usr_lastname ?? '', 'email' => $s->usr_email ?? '',
                        'phone' => $s->usr_phone ?? '',
                        'fullname' => trim(($s->usr_firstname ?? '') . ' ' . ($s->usr_lastname ?? '')),
                    ];
                }
                if ($document->lines && $document->lines->count() > 0) {
                    $data['sub_lines'] = $document->lines->map(fn($l) => [
                        'reference'   => $l->orl_reference  ?? '',
                        'description' => $l->orl_description ?? '',
                        'quantity'    => $l->orl_qty         ?? 0,
                        'unit_price'  => number_format($l->orl_pu      ?? 0, 2, ',', ' '),
                        'discount'    => $l->orl_discount    ?? 0,
                        'total_ht'    => number_format($l->orl_mtht    ?? 0, 2, ',', ' '),
                        'tax_rate'    => $l->orl_tax_rate    ?? 0,
                    ])->toArray();
                }
            }

        } elseif ($context === 'invoice') {
            $document = InvoiceModel::with(['partner', 'contact', 'lines', 'seller'])->find($documentId);
            if ($document) {
                $data['invoice'] = [
                    'id'               => $document->inv_id,
                    'number'           => $document->inv_number   ?? '',
                    'date'             => $document->inv_date     ? $document->inv_date->format('d/m/Y')    : '',
                    'duedate'          => $document->inv_duedate  ? $document->inv_duedate->format('d/m/Y') : '',
                    'total_ht'         => number_format($document->inv_totalht          ?? 0, 2, ',', ' '),
                    'total_tax'        => number_format($document->inv_totaltax         ?? 0, 2, ',', ' '),
                    'total_ttc'        => number_format($document->inv_totalttc         ?? 0, 2, ',', ' '),
                    'amount_remaining' => number_format($document->inv_amount_remaining ?? 0, 2, ',', ' '),
                    'note'             => $document->inv_note ?? '',
                    'ref'              => $document->inv_ref  ?? '',
                ];
                if ($document->partner) {
                    $p = $document->partner;
                    $data['partner'] = [
                        'id'      => $p->ptr_id,      'name'    => $p->ptr_name    ?? '',
                        'email'   => $p->ptr_email    ?? '',  'phone'   => $p->ptr_phone   ?? '',
                        'mobile'  => $p->ptr_mobile   ?? '',  'address' => $p->ptr_address ?? '',
                        'zip'     => $p->ptr_zip      ?? '',  'city'    => $p->ptr_city    ?? '',
                        'country' => $p->ptr_country  ?? '',  'tva_code'=> $p->ptr_tva_code ?? '',
                        'siret'   => $p->ptr_siret    ?? '',
                    ];
                }
                if ($document->contact) {
                    $c = $document->contact;
                    $data['contact'] = [
                        'id'        => $c->ctc_id,
                        'firstname' => $c->ctc_firstname ?? '', 'lastname'  => $c->ctc_lastname  ?? '',
                        'email'     => $c->ctc_email     ?? '', 'phone'     => $c->ctc_phone     ?? '',
                        'mobile'    => $c->ctc_mobile    ?? '', 'jobtitle'  => $c->ctc_job_title ?? '',
                        'fullname'  => trim(($c->ctc_firstname ?? '') . ' ' . ($c->ctc_lastname ?? '')),
                    ];
                }
                if ($document->seller) {
                    $s = $document->seller;
                    $data['seller'] = [
                        'id' => $s->usr_id, 'firstname' => $s->usr_firstname ?? '',
                        'lastname' => $s->usr_lastname ?? '', 'email' => $s->usr_email ?? '',
                        'phone' => $s->usr_phone ?? '',
                        'fullname' => trim(($s->usr_firstname ?? '') . ' ' . ($s->usr_lastname ?? '')),
                    ];
                }
                if ($document->lines && $document->lines->count() > 0) {
                    $data['sub_lines'] = $document->lines->map(fn($l) => [
                        'reference'   => $l->inl_reference  ?? '',
                        'description' => $l->inl_description ?? '',
                        'quantity'    => $l->inl_qty         ?? 0,
                        'unit_price'  => number_format($l->inl_pu      ?? 0, 2, ',', ' '),
                        'discount'    => $l->inl_discount    ?? 0,
                        'total_ht'    => number_format($l->inl_mtht    ?? 0, 2, ',', ' '),
                        'tax_rate'    => $l->inl_tax_rate    ?? 0,
                    ])->toArray();
                }
            }
        }

        return $data;
    }


    /**
     * Remplace les variables avec notation pointée {key.subkey} dans un template
     * Supporte plusieurs niveaux: {answer.tka_message}, {user.profile.name}, etc.
     *
     * @param string $template Le template contenant les variables à remplacer
     * @param array $data Les données contenant les tableaux et valeurs
     * @param string $startDelimiter Le délimiteur d'ouverture (par défaut '{')
     * @param string $endDelimiter Le délimiteur de fermeture (par défaut '}')
     * @return string Le template avec les variables remplacées
     */
    private function replaceNestedVariables(string $template, array $data, string $startDelimiter = '{', string $endDelimiter = '}'): string
    {
        // Pattern pour capturer les variables avec notation pointée {key.subkey} ou {key.subkey.subsubkey}
        $pattern = '/' . preg_quote($startDelimiter, '/') . '([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)' . preg_quote($endDelimiter, '/') . '/';

        return preg_replace_callback($pattern, function ($matches) use ($data) {
            $fullPath = $matches[1]; // Ex: "answer.tka_message" ou "user.profile.name"
            $keys = explode('.', $fullPath);

            // Parcourir les clés pour accéder à la valeur imbriquée
            $value = $data;
            foreach ($keys as $key) {
                if (is_array($value) && isset($value[$key])) {
                    $value = $value[$key];
                } else {
                    // Si la clé n'existe pas, retourner la variable non remplacée
                    return $matches[0];
                }
            }

            // Si la valeur finale n'est pas un tableau, la retourner
            if (!is_array($value)) {
                return $value ?? '';
            }

            // Si c'est un tableau, retourner la variable non remplacée
            return $matches[0];
        }, $template);
    }

    /**
     * Parse un template avec les données fournies
     *
     * @param int $emtId L'ID du template
     * @param array $data Les données pour le remplacement des variables
     * @param string $startDelimiter Le délimiteur d'ouverture (par défaut '{')
     * @param string $endDelimiter Le délimiteur de fermeture (par défaut '}')
     * @return array ['body' => string, 'subject' => string]
     */
    public function parseTemplate(int $emtId, array $data = [], string $startDelimiter = '{', string $endDelimiter = '}'): array
    {
        $resultEmt = MessageTemplateModel::find($emtId);

        if ($resultEmt) {
            $subject = $resultEmt->emt_subject ?? '';
            $body = $resultEmt->emt_body ?? '';
        } else {
            $subject = "";
            $body = "";
        }

        // Remplacer les variables imbriquées (notation pointée) {key.subkey}
        $subject = $this->replaceNestedVariables($subject, $data, $startDelimiter, $endDelimiter);
        $body = $this->replaceNestedVariables($body, $data, $startDelimiter, $endDelimiter);

        // Remplacer les variables simples {key}
        foreach ($data as $key => $val) {
            $placeholder = $startDelimiter . $key . $endDelimiter;
            if (!is_array($val) && str_contains($subject, $placeholder)) {
                $subject = str_replace($placeholder, $val ?? '', $subject);
            }
            if (!is_array($val) && str_contains($body, $placeholder)) {
                $body = str_replace($placeholder, $val ?? '', $body);
            }
        }

        // Traiter les conditions <!--#IF ((key))#-->...<!--#ENDIF#--> dans le corps principal
        $body    = $this->parseConditionals($body, $data);
        $subject = $this->parseConditionals($subject, $data);

        // Traiter les boucles FOREACH
        $sub_data = $this->getAllForeach($body, $startDelimiter, $endDelimiter);
        if ($sub_data) {
            foreach ($sub_data as $foreach) {
                $suffix = $foreach['suffix'];
                if (isset($data["sub_" . $suffix])) {
                    $parsed = $this->parseSubTemplate($foreach['content'], $data["sub_" . $suffix], $startDelimiter, $endDelimiter);
                    $pattern = '/' . preg_quote($startDelimiter, '/') . 'FOREACH_' . preg_quote($suffix, '/') . preg_quote($endDelimiter, '/') . '[\s\S]+?' . preg_quote($startDelimiter, '/') . 'ENDFOREACH_' . preg_quote($suffix, '/') . preg_quote($endDelimiter, '/') . '/i';
                    $body = preg_replace($pattern, $parsed, $body);
                }
            }
        }

        return [
            'body'    => $body,
            'subject' => $subject,
        ];
    }

    /**
     * Résout la valeur d'une clé (simple ou notation pointée) dans $data.
     * Retourne null si la clé n'existe pas.
     */
    private function resolveKey(string $key, array $data): mixed
    {
        $keys  = explode('.', $key);
        $value = $data;
        foreach ($keys as $k) {
            if (is_array($value) && array_key_exists($k, $value)) {
                $value = $value[$k];
            } else {
                return null;
            }
        }
        return $value;
    }

    /**
     * Traite les blocs <!--#IF ((key))#-->...<!--#ENDIF#--> dans un template.
     * Supporte la notation simple (key) et pointée (key.subkey).
     * Le bloc est affiché si la valeur est non nulle et non vide, supprimé sinon.
     */
    private function parseConditionals(string $template, array $data): string
    {
        return preg_replace_callback(
            '/<!--#IF \(\(([\w.]+)\)\)#-->(.*?)<!--#ENDIF#-->/s',
            function ($matches) use ($data) {
                $key   = trim($matches[1]);
                $content = $matches[2];
                $value = $this->resolveKey($key, $data);
                return (!is_null($value) && $value !== '') ? $content : '';
            },
            $template
        );
    }

    /**
     * Parse un sous-template (contenu d'une boucle FOREACH)
     *
     * @param string $template Le template à parser
     * @param array $data Les données pour le remplacement
     * @param string $startDelimiter Le délimiteur d'ouverture (par défaut '{')
     * @param string $endDelimiter Le délimiteur de fermeture (par défaut '}')
     * @return string Le template parsé
     */
    private function parseSubTemplate(string $template, array $data, string $startDelimiter = '{', string $endDelimiter = '}'): string
    {
        $parsed = "";
        foreach ($data as $row) {
            $temp_parsed = preg_replace_callback('/<!--#IF ((.*?))#-->(.*?)<!--#ENDIF#-->/s', function ($matches) use ($row) {
                $key = trim($matches[2]);
                $contenu = trim($matches[3]);

                if (isset($row[$key]) && !empty($row[$key])) {
                    return $contenu;
                } else {
                    return '';
                }
            }, $template);

            // Remplacer les variables imbriquées dans le sous-template
            $temp_parsed = $this->replaceNestedVariables($temp_parsed, $row, $startDelimiter, $endDelimiter);

            // Remplacer les variables simples
            foreach ($row as $item_k => $item_v) {
                $placeholder = $startDelimiter . $item_k . $endDelimiter;
                if (str_contains($temp_parsed, $placeholder)) {
                    if ($item_v == null) $item_v = "";

                    if (!empty($item_v) && strtotime($item_v) !== false) {
                        $DateTime = new \DateTime($item_v);
                        $item_v = $DateTime->format('m/d/Y H:i');
                    }
                    $temp_parsed = str_replace($placeholder, $item_v, $temp_parsed);
                }
            }
            $parsed .= $temp_parsed;
        }
        return $parsed;
    }

    /**
     * Retourne le Suffix et le contenu de chaque boucle FOREACH
     *
     * @param string $template Le template contenant les boucles
     * @param string $startDelimiter Le délimiteur d'ouverture (par défaut '{')
     * @param string $endDelimiter Le délimiteur de fermeture (par défaut '}')
     * @return array|false Les boucles trouvées ou false si aucune
     */
    private function getAllForeach(string $template, string $startDelimiter = '{', string $endDelimiter = '}'): array|false
    {
        $foundForeach = [];
        $pattern = '/' . preg_quote($startDelimiter, '/') . 'FOREACH_(\w+)' . preg_quote($endDelimiter, '/') . '(.*?)' . preg_quote($startDelimiter, '/') . 'ENDFOREACH_\1' . preg_quote($endDelimiter, '/') . '/s';
        
        if (preg_match_all($pattern, $template, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $suffix = $match[1];  // Le suffixe, ex: tkas
                $content = $match[2]; // Le contenu entre FOREACH et ENDFOREACH
                $foundForeach[] = [
                    'suffix' => $suffix,
                    'content' => $content
                ];
            }
        }
        return !empty($foundForeach) ? $foundForeach : false;
    }
}