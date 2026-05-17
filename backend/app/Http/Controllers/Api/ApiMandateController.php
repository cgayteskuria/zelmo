<?php

namespace App\Http\Controllers\Api;

use App\Models\BankDetailsModel;
use App\Models\CompanyModel;
use App\Models\PartnerModel;
use App\Services\EmailService;
use App\Services\IbanService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class ApiMandateController extends Controller
{
    private const TOKEN_EXPIRY_DAYS = 30;

    public function __construct(private EmailService $emailService) {}

    /**
     * POST /api/partners/{id}/mandate
     * Génère un lien temporaire de mandat SEPA et l'envoie par email (auth requise).
     */
    public function generateMandateLink(Request $request, int $id): JsonResponse
    {
        $partner = PartnerModel::find($id);
        if (!$partner) {
            return response()->json(['success' => false, 'message' => 'Partenaire introuvable'], 404);
        }

        if (!$partner->ptr_is_customer) {
            return response()->json(['success' => false, 'message' => 'Ce tiers n\'est pas un client'], 422);
        }

        $token   = bin2hex(random_bytes(32));
        $expires = Carbon::now()->addDays(self::TOKEN_EXPIRY_DAYS);
        $url     = rtrim(config('app.frontend_url'), '/') . '/mandate/' . $token;

        $partner->update([
            'ptr_mandate_token'             => $token,
            'ptr_mandate_token_expires_at'  => $expires,
            'ptr_mandate_sent_at'           => Carbon::now(),
            'ptr_mandate_completed_at'      => null,
            'ptr_mandate_signer_email'      => null,
        ]);

        // Envoi email au partenaire (fire-and-forget)
        if ($partner->ptr_email) {
            $this->sendInvitationEmail($partner, $url, $expires);
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'mandate_url' => $url,
                'expires_at'  => $expires->toIso8601String(),
            ],
        ]);
    }

    /**
     * GET /api/public/mandate/{token}
     * Retourne les données pré-remplies pour le formulaire public (sans auth).
     */
    public function getMandate(string $token): JsonResponse
    {
        [$partner, $error, $status] = $this->resolveToken($token);
        if ($error) {
            return response()->json(['success' => false, 'message' => $error], $status);
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'ptr_name'         => $partner->ptr_name,
                'ptr_address'      => $partner->ptr_address,
                'ptr_zip'          => $partner->ptr_zip,
                'ptr_city'         => $partner->ptr_city,
                'ptr_country_code' => $partner->ptr_country_code,
                'ptr_email'        => $partner->ptr_email,
                'ptr_siret'        => $partner->ptr_siret,
                'expires_at'       => $partner->ptr_mandate_token_expires_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * POST /api/public/mandate/{token}
     * Soumet le formulaire de mandat SEPA (sans auth).
     */
    public function submit(Request $request, string $token): JsonResponse
    {
        [$partner, $error, $status] = $this->resolveToken($token);
        if ($error) {
            return response()->json(['success' => false, 'message' => $error], $status);
        }

        $validator = Validator::make($request->all(), [
            'ptr_name'          => 'required|string|max:100',
            'ptr_address'       => 'nullable|string|max:500',
            'ptr_zip'           => 'nullable|string|max:10',
            'ptr_city'          => 'nullable|string|max:100',
            'ptr_country_code'  => 'nullable|string|size:2',
            'email'             => 'required|email|max:255',
            'ptr_siret'         => 'nullable|string|max:14',
            'iban'              => 'required|string|min:15|max:34',
            'bic'               => 'required|string|min:8|max:11',
            'bank_domiciliation'=> 'required|string|max:100',
            'account_holder'    => 'required|string|max:100',
            'consent'           => 'required|accepted',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        // Valider l'IBAN
        $ibanError = IbanService::validate($request->input('iban'));
        if ($ibanError) {
            return response()->json(['success' => false, 'message' => 'IBAN invalide : ' . $ibanError], 422);
        }

        $iban       = IbanService::normalize($request->input('iban'));
        $bban       = IbanService::extractBbanComponents($iban);

        // Retirer le défaut existant puis créer la nouvelle banque par défaut
        BankDetailsModel::where('fk_ptr_id', $partner->ptr_id)->update(['bts_is_default' => 0]);

        BankDetailsModel::create([
            'bts_label'       => $request->input('account_holder'),
            'bts_iban'        => $iban,
            'bts_bic'         => strtoupper(str_replace(' ', '', $request->input('bic'))),
            'bts_bnal_address'=> $request->input('bank_domiciliation'),
            'bts_bank_code'   => $bban['bank_code'] ?? null,
            'bts_sort_code'   => $bban['sort_code'] ?? null,
            'bts_account_nbr' => $bban['account_nbr'] ?? null,
            'bts_bban_key'    => $bban['bban_key'] ?? null,
            'fk_ptr_id'       => $partner->ptr_id,
            'bts_is_default'  => 1,
            'bts_is_active'   => 1,
        ]);

        $partner->update([
            'ptr_mandate_completed_at' => Carbon::now(),
            'ptr_mandate_signer_email' => $request->input('email'),
        ]);

        // Email de confirmation
        $this->sendConfirmationEmail($request, $iban);

        return response()->json([
            'success' => true,
            'message' => 'Le prélèvement automatique a bien été mis en place.',
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers privés
    // ──────────────────────────────────────────────────────────────────────────

    private function resolveToken(string $token): array
    {
        $partner = PartnerModel::where('ptr_mandate_token', $token)->first();

        if (!$partner) {
            return [null, 'Lien invalide ou introuvable', 404];
        }

        if ($partner->ptr_mandate_token_expires_at && $partner->ptr_mandate_token_expires_at->isPast()) {
            return [null, 'Ce lien a expiré', 410];
        }

        if ($partner->ptr_mandate_completed_at) {
            return [null, 'Ce mandat a déjà été complété', 410];
        }

        return [$partner, null, 200];
    }

    private function sendInvitationEmail(PartnerModel $partner, string $url, Carbon $expires): void
    {
        try {
            $company = CompanyModel::with(['emailDefault'])->first();
            $account = $company?->emailDefault;
            if (!$account) {
                return;
            }

            $expiryFr = $expires->locale('fr')->isoFormat('D MMMM YYYY');
            $subject  = 'Mise en place d\'un prélèvement automatique — ' . $partner->ptr_name;
            $body     = $this->buildInvitationBody($partner->ptr_name, $url, $expiryFr);

            $this->emailService->sendEmail($account, $partner->ptr_email, $subject, $body);
        } catch (\Exception $e) {
            Log::warning('Mandate invitation email failed', [
                'partner_id' => $partner->ptr_id,
                'error'      => $e->getMessage(),
            ]);
        }
    }

    private function sendConfirmationEmail(Request $request, string $iban): void
    {
        try {
            $company = CompanyModel::with(['emailDefault'])->first();
            $account = $company?->emailDefault;
            if (!$account) {
                return;
            }

            $subject = 'Le prélèvement automatique a bien été mis en place';
            $body    = $this->buildConfirmationBody($request, IbanService::format($iban));

            $this->emailService->sendEmail($account, $request->input('email'), $subject, $body);
        } catch (\Exception $e) {
            Log::warning('Mandate confirmation email failed', [
                'email' => $request->input('email'),
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function buildInvitationBody(string $partnerName, string $url, string $expiryFr): string
    {
        return <<<HTML
        <html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px">
        <p>Bonjour,</p>
        <p>Afin de mettre en place un <strong>prélèvement automatique SEPA</strong>,
           merci de compléter le formulaire en ligne en cliquant sur le lien ci-dessous.</p>
        <p>Ce lien est valable jusqu'au <strong>{$expiryFr}</strong>.</p>
        <p style="margin:24px 0">
            <a href="{$url}" style="background:#1677ff;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
                Renseigner mes coordonnées bancaires
            </a>
        </p>
        <p style="font-size:12px;color:#888">
            Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
            <a href="{$url}">{$url}</a>
        </p>
        <p>Cordialement</p>
        </body></html>
        HTML;
    }

    private function buildConfirmationBody(Request $request, string $ibanFormatted): string
    {
        $name    = htmlspecialchars($request->input('ptr_name', ''));
        $address = htmlspecialchars($request->input('ptr_address', ''));
        $zip     = htmlspecialchars($request->input('ptr_zip', ''));
        $city    = htmlspecialchars($request->input('ptr_city', ''));
        $email   = htmlspecialchars($request->input('email', ''));
        $siret   = htmlspecialchars($request->input('ptr_siret', ''));
        $holder  = htmlspecialchars($request->input('account_holder', ''));
        $bic     = htmlspecialchars(strtoupper(str_replace(' ', '', $request->input('bic', ''))));
        $bank    = htmlspecialchars($request->input('bank_domiciliation', ''));
        $now     = Carbon::now()->locale('fr')->isoFormat('D MMMM YYYY [à] HH:mm');

        return <<<HTML
        <html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px">
        <p>Bonjour,</p>
        <p>Votre <strong>mandat de prélèvement automatique SEPA</strong> a bien été enregistré.
           Voici le récapitulatif des informations transmises :</p>

        <h3 style="border-bottom:1px solid #eee;padding-bottom:8px">Informations société</h3>
        <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#666;width:40%"><strong>Société</strong></td><td>{$name}</td></tr>
            <tr><td style="padding:6px 0;color:#666"><strong>Adresse</strong></td><td>{$address}, {$zip} {$city}</td></tr>
            <tr><td style="padding:6px 0;color:#666"><strong>SIRET</strong></td><td>{$siret}</td></tr>
            <tr><td style="padding:6px 0;color:#666"><strong>Email</strong></td><td>{$email}</td></tr>
        </table>

        <h3 style="border-bottom:1px solid #eee;padding-bottom:8px;margin-top:24px">Coordonnées bancaires</h3>
        <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#666;width:40%"><strong>Titulaire du compte</strong></td><td>{$holder}</td></tr>
            <tr><td style="padding:6px 0;color:#666"><strong>IBAN</strong></td><td style="font-family:monospace">{$ibanFormatted}</td></tr>
            <tr><td style="padding:6px 0;color:#666"><strong>BIC</strong></td><td>{$bic}</td></tr>
            <tr><td style="padding:6px 0;color:#666"><strong>Domiciliation bancaire</strong></td><td>{$bank}</td></tr>
        </table>

        <p style="margin-top:24px;font-size:13px;color:#888">
            Ce mandat a été enregistré le {$now}.
        </p>
        <p>Cordialement</p>
        </body></html>
        HTML;
    }
}
