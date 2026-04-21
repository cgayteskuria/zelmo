<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\TicketArticleModel;
use App\Models\TicketModel;
use App\Models\TicketConfigModel;
use App\Services\EmailService;
use App\Services\TemplateParserService;

class ApiTicketArticleController extends Controller
{
    /**
     * Liste des articles d'un ticket
     */
    public function index($ticketId)
    {
        $articles = TicketArticleModel::where('tkt_id', $ticketId)
            ->with([
                'user' => function ($query) {
                    $query->selectRaw("usr_id, TRIM(CONCAT_WS(' ', usr_firstname, usr_lastname)) as label");
                },
                'contactFrom:ctc_id,ctc_firstname,ctc_lastname,ctc_email',
                'contactTo:ctc_id,ctc_firstname,ctc_lastname,ctc_email',
            ])
            ->orderBy('tka_created', 'desc')
            ->get();

        return response()->json([
            'data' => $articles,
        ]);
    }

    /**
     * Creation d'un article (note interne ou reponse)
     */
    public function store(Request $request)
    {
        $ticketId = $request->route('ticketId');

        // Verifier que le ticket existe
        $ticket = TicketModel::find($ticketId);
        if (!$ticket) {
            return response()->json([
                'success' => false,
                'message' => 'Dossier non trouve',
            ], 404);
        }

        try {
            $article = new TicketArticleModel();

            $data = $request->all();
            $data['tkt_id'] = $ticketId;

            // Date par defaut
            if (empty($data['tka_date'])) {
                $data['tka_date'] = now();
            }

            // Temps par defaut
            if (!isset($data['tka_tps'])) {
                $data['tka_tps'] = 0;
            }

            // Utilisateur courant
            if ($request->user()) {
                $data['fk_usr_id'] = $request->user()->usr_id;
                $data['fk_usr_id_author'] = $request->user()->usr_id;
                $data['fk_usr_id_updater'] = $request->user()->usr_id;
            }

            $article->updateSafe($data);

            // Recalculer le temps total du ticket
            ApiTicketController::updateTotalTime($ticketId);

            // Mettre a jour le statut du ticket si fourni (prochain statut)
            $ticketUpdate = ['tkt_updated' => now()];
            if (!empty($request->input('fk_tke_id'))) {
                $ticketUpdate['fk_tke_id'] = (int) $request->input('fk_tke_id');
                if ($request->user()) {
                    $ticketUpdate['fk_usr_id_updater'] = $request->user()->usr_id;
                }
            }
            $ticket->update($ticketUpdate);

            // Envoyer par email si c'est une réponse (pas une note interne)
            $isNote = !empty($data['tka_is_note']) && (int) $data['tka_is_note'] === 1;
            if (!$isNote) {
                $this->sendReplyEmail($ticket, $article);
            }

            return response()->json([
                'success'    => true,
                'message'    => 'Article ajoute avec succes',
                'data'       => ['tka_id' => $article->tka_id],
                'fk_tke_id'  => $ticketUpdate['fk_tke_id'] ?? null,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Envoie l'email de réponse via le compte et le template configurés dans ticket_config_tco
     */
    private function sendReplyEmail(TicketModel $ticket, TicketArticleModel $article): void
    {
        try {
            $config = TicketConfigModel::with(['emailAccount', 'answerTemplate'])->first();

            if (!$config || !$config->emailAccount || !$config->fk_emt_id_answer) {
                Log::warning('TicketReply: configuration email ou template manquant');
                return;
            }

            // Destinataire : contact "À" du ticket ou de l'article
            $ticket->loadMissing(['openTo', 'partner']);
            $contact = $ticket->openTo;
            if (!$contact || empty($contact->ctc_email)) {
                Log::warning('TicketReply: aucun email destinataire pour le ticket ' . $ticket->tkt_id);
                return;
            }

            // Construire les données pour le parser via TemplateParserService
            $data = TemplateParserService::buildData('ticket', $ticket->tkt_id, $article);
            $parser  = new TemplateParserService();
            $parsed  = $parser->parseTemplate($config->fk_emt_id_answer, $data);

            $emailService = new EmailService();
            $result = $emailService->sendEmail(
                $config->emailAccount,
                $contact->ctc_email,
                $parsed['subject'],
                $parsed['body'],
                !empty($article->tka_cc) ? ['cc' => array_map('trim', explode(',', $article->tka_cc))] : []
            );

            if (!$result['success']) {
                Log::error('TicketReply: échec envoi email', ['message' => $result['message']]);
            }
        } catch (\Throwable $e) {
            Log::error('TicketReply: exception lors de l\'envoi', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Mise à jour d'un article (note interne)
     */
    public function update(Request $request, $articleId)
    {
        $ticketId = $request->route('ticketId');

        $article = TicketArticleModel::where('tkt_id', $ticketId)
            ->where('tka_id', $articleId)
            ->first();

        if (!$article) {
            return response()->json(['success' => false, 'message' => 'Article non trouvé'], 404);
        }

        try {
            $data = $request->only(['tka_message', 'tka_tps']);
            if ($request->user()) {
                $data['fk_usr_id_updater'] = $request->user()->usr_id;
            }
            $article->updateSafe($data);

            if (array_key_exists('tka_tps', $data)) {
                ApiTicketController::updateTotalTime($ticketId);
            }

            return response()->json(['success' => true, 'message' => 'Article mis à jour']);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Suppression d'un article
     */
    public function destroy($articleId)
    {
        $ticketId = request()->route('ticketId');

        $article = TicketArticleModel::where('tkt_id', $ticketId)
            ->where('tka_id', $articleId)
            ->first();

        if (!$article) {
            return response()->json([
                'success' => false,
                'message' => 'Article non trouve',
            ], 404);
        }

        try {
            // Le trait DeletesRelatedDocuments supprime les documents automatiquement
            $article->delete();

            // Recalculer le temps total du ticket
            ApiTicketController::updateTotalTime($ticketId);

            return response()->json([
                'success' => true,
                'message' => 'Article supprime avec succes',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression: ' . $e->getMessage(),
            ], 500);
        }
    }
}
