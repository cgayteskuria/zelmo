<?php

namespace App\Services;

use App\Models\TicketArticleModel;
use App\Models\TicketConfigModel;
use App\Models\TicketModel;
use App\Models\TicketSourceModel;
use Illuminate\Support\Facades\Log;
use Webklex\PHPIMAP\Message;

class FetchEmailTicketsService
{
    public function __construct(private EmailService $emailService) {}

    /**
     * Se connecte à la boîte IMAP configurée, crée des tickets depuis les emails non lus,
     * puis supprime définitivement chaque email traité.
     *
     * @return array{processed: int, errors: string[]}
     */
    public function fetchAndCreateTickets(int $limit = 50): array
    {
        $config = TicketConfigModel::with('emailAccount')->find(1);

        if (!$config || !$config->fk_eml_id || !$config->emailAccount) {
            return ['processed' => 0, 'errors' => ['Aucun compte email configuré dans les paramètres assistance.']];
        }

        $emailAccount = $config->emailAccount;
        $processed = 0;
        $errors = [];

        try {
            $client = $this->emailService->createImapClient($emailAccount);

            $inbox = $client->getFolder('INBOX');
            $messages = $inbox->messages()->unseen()->setFetchOrder('asc')->get()->take($limit);

            foreach ($messages as $message) {
                try {
                    $this->createTicketFromEmail($message, $config);
                    $message->delete(true); // expunge immédiat
                    $processed++;
                } catch (\Throwable $e) {
                    $subject = $message->getSubject() ?? '(sans objet)';
                    $errors[] = "Email \"{$subject}\": " . $e->getMessage();
                    Log::error('FetchEmailTickets: erreur traitement email', [
                        'subject' => $subject,
                        'error'   => $e->getMessage(),
                    ]);
                }
            }

            $client->disconnect();
        } catch (\Throwable $e) {
            $errors[] = 'Connexion IMAP: ' . $e->getMessage();
            Log::error('FetchEmailTickets: connexion IMAP échouée', ['error' => $e->getMessage()]);
        }

        Log::info("FetchEmailTickets: {$processed} ticket(s) créé(s)", ['errors_count' => count($errors)]);

        return ['processed' => $processed, 'errors' => $errors];
    }

    private function createTicketFromEmail(Message $message, TicketConfigModel $config): void
    {
        $subject = trim($message->getSubject() ?? '') ?: '(Sans objet)';
        $from    = $message->getFrom()->first();
        $fromEmail = $from?->mail ?? '';

        // Source "Email" si elle existe en base
        $source = TicketSourceModel::whereRaw('LOWER(tks_label) LIKE ?', ['%email%'])->first();

        $ticket = TicketModel::create([
            'tkt_label'    => $subject,
            'tkt_opendate' => $message->getDate()?->toDateTimeString() ?? now()->toDateTimeString(),
            'fk_tks_id'    => $source?->tks_id,
        ]);

        $body = $message->getHTMLBody() ?? $message->getTextBody() ?? '';

        TicketArticleModel::create([
            'tkt_id'     => $ticket->tkt_id,
            'tka_date'   => now(),
            'tka_tps'    => 0,
            'tka_is_note' => 0,
            'tka_from'   => $fromEmail,
            'tka_subject' => $subject,
            'tka_message' => $body,
            'fk_eml_id'  => $config->fk_eml_id,
        ]);
    }
}
