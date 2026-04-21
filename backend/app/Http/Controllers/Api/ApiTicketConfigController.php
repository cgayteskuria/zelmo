<?php

namespace App\Http\Controllers\Api;

use App\Models\TicketConfigModel;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ApiTicketConfigController extends Controller
{
    /**
     * Afficher la configuration du module assistance (il n'y en a qu'une seule, ID=1)
     */
    public function show($id = 1)
    {
        $config = TicketConfigModel::with([
            'author:usr_id,usr_firstname,usr_lastname',
            'updater:usr_id,usr_firstname,usr_lastname',
            'emailAccount:eml_id,eml_label,eml_address',
            'acknowledgmentTemplate:emt_id,emt_label',
            'affectationTemplate:emt_id,emt_label',
            'answerTemplate:emt_id,emt_label',
        ])->findOrFail($id);

        return response()->json([
            'status' => true,
            'data' => $config,
        ], 200);
    }

    /**
     * Mettre à jour la configuration du module assistance
     */
    public function update(Request $request, $id = 1)
    {
        try {
            $validatedData = $request->validate([
                'fk_eml_id' => 'nullable|exists:message_email_account_eml,eml_id',
                'tco_send_acknowledgment' => 'nullable|boolean',
                'fk_emt_id_acknowledgment' => 'nullable|exists:message_template_emt,emt_id',
                'fk_emt_id_affectation' => 'nullable|exists:message_template_emt,emt_id',
                'fk_emt_id_answer' => 'nullable|exists:message_template_emt,emt_id',
            ]);

            // Si tco_send_acknowledgment est true, fk_emt_id_acknowledgment devient requis
            if ($request->input('tco_send_acknowledgment') && !$request->filled('fk_emt_id_acknowledgment')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Le template d\'accusé de réception est requis si vous activez l\'envoi d\'accusé de réception',
                    'errors' => [
                        'fk_emt_id_acknowledgment' => ['Le template d\'accusé de réception est requis si vous activez l\'envoi d\'accusé de réception']
                    ]
                ], 422);
            }

            $config = TicketConfigModel::findOrFail($id);

            $validatedData['fk_usr_id_updater'] = $request->user()->usr_id;
            $validatedData['tco_send_acknowledgment'] = $request->input('tco_send_acknowledgment', false);

            $config->update($validatedData);

            return response()->json([
                'success' => true,
                'message' => 'Configuration du module assistance mise à jour avec succès',
                'data' => $config->load([
                    'author',
                    'updater',
                    'emailAccount',
                    'acknowledgmentTemplate',
                    'affectationTemplate',
                    'answerTemplate'
                ]),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la mise à jour: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Forcer la collecte des emails pour créer des tickets
     */
    public function forceEmailCollection(Request $request)
    {
        try {
            // TODO: Implémenter la logique de collecte des emails
            // Cette méthode devrait appeler un service qui:
            // 1. Se connecte au compte email configuré
            // 2. Récupère les nouveaux emails
            // 3. Crée des tickets à partir des emails
            // 4. Marque les emails comme traités

            // Pour l'instant, on retourne un message simulé
            // À implémenter selon votre logique métier existante

            $limit = $request->input('limit', 50);

            // Exemple de ce qui devrait être fait:
            // $ticketService = new TicketEmailService();
            // $result = $ticketService->collectEmailsAndCreateTickets($limit);

            // Simulation de réponse
            $result = [
                'success' => true,
                'processed' => 0,
                'errors' => [],
                'message' => 'Collecte des emails en cours de développement. Cette fonctionnalité nécessite l\'implémentation du service de collecte d\'emails.'
            ];

            return response()->json([
                'success' => $result['success'],
                'errors' => $result['errors'] ?? [],
                'message' => $result['message'] ?? "{$result['processed']} ticket(s) créé(s) depuis les emails"
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur: ' . $e->getMessage()
            ], 500);
        }
    }
}
