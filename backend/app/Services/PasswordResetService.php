<?php

namespace App\Services;

use App\Models\CompanyModel;

use App\Models\UserModel;
use App\Services\TemplateParserService;
use App\Services\EmailService;
use Illuminate\Support\Str;


class PasswordResetService
{
    private TemplateParserService $templateParser;

    public function __construct()
    {
        $this->templateParser = new TemplateParserService();
    }

    /**
     * Genere un token de reset et l'enregistre pour l'utilisateur
     *
     * @param UserModel $user
     * @return string Le token genere
     */
    public function generateResetToken(UserModel $user): string
    {
        $token = Str::random(64);

        $user->usr_password_reset_token = hash('sha256', $token);
        $user->usr_password_reset_token_expires_at = now()->addHours(1);
        $user->save();

        return $token;
    }

    /**
     * Verifie si un token de reset est valide
     *
     * @param string $token Le token a verifier
     * @return UserModel|null L'utilisateur si le token est valide, null sinon
     */
    public function validateResetToken(string $token): ?UserModel
    {
        $hashedToken = hash('sha256', $token);

        $user = UserModel::where('usr_password_reset_token', $hashedToken)
            ->where('usr_password_reset_token_expires_at', '>', now())
            ->first();

        return $user;
    }

    /**
     * Reinitialise le mot de passe de l'utilisateur
     *
     * @param UserModel $user
     * @param string $newPassword
     * @return bool
     */
    public function resetPassword(UserModel $user, string $newPassword): bool
    {
        $user->usr_password = $newPassword;
        $user->usr_password_reset_token = null;
        $user->usr_password_reset_token_expires_at = null;
        $user->usr_password_updated_at = now();
        $user->usr_failed_login_attempts = 0;
        $user->usr_locked_until = null;

        return $user->save();
    }

    /**
     * Envoie l'email de reinitialisation de mot de passe
     *
     * @param UserModel $user
     * @param string $token
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendResetEmail(UserModel $user, string $token): array
    {
        // Recuperer la company avec le template de reset password
        $company = CompanyModel::with(['resetPasswordTemplate', 'emailDefault'])->first();

        if (!$company) {
            return [
                'success' => false,
                'message' => 'Configuration de l\'entreprise introuvable'
            ];
        }

        if (!$company->fk_emt_id_reset_password) {
            return [
                'success' => false,
                'message' => 'Template d\'email de reinitialisation non configure'
            ];
        }

        if (!$company->emailDefault) {
            return [
                'success' => false,
                'message' => 'Compte email par defaut non configure'
            ];
        }

        // Generer le lien de reset
        $resetLink = config('app.frontend_url', 'http://localhost:5173') . '/reset-password?token=' . $token;

        // Preparer les donnees pour le template
        $templateData = [
            'mail_parser' => $company->cop_mail_parser ?? '',
            'user_firstname' => $user->usr_firstname ?? '',
            'user_lastname' => $user->usr_lastname ?? '',
            'user_email' => $user->usr_login,
            'user_fullname' => trim(($user->usr_firstname ?? '') . ' ' . ($user->usr_lastname ?? '')),
            'reset_link' => $resetLink,
            'company_name' => $company->cop_label ?? '',
            'company_phone' => $company->cop_phone ?? '',
            'expiration_hours' => '1',
            'user' => [
                'firstname' => $user->usr_firstname ?? '',
                'lastname' => $user->usr_lastname ?? '',
                'email' => $user->usr_login,
            ],
            'company' => [
                'name' => $company->cop_label ?? '',
                'phone' => $company->cop_phone ?? '',
            ]
        ];

        // Parser le template
        $parsedTemplate = $this->templateParser->parseTemplate(
            $company->fk_emt_id_reset_password,
            $templateData
        );

        // Envoyer l'email
        $emailService = new EmailService();
        return  $emailService->sendEmail(
            $company->emailDefault,
            $user->usr_login,
            $parsedTemplate['subject'],
            $parsedTemplate['body']
        );
    }

    /**
     * Envoie l'email de confirmation de changement de mot de passe
     *
     * @param UserModel $user
     * @return array ['success' => bool, 'message' => string]
     */
    public function sendPasswordChangedEmail(UserModel $user): array
    {
        // Recuperer la company avec le template de confirmation
        $company = CompanyModel::with(['changedPasswordTemplate', 'emailDefault'])->first();

        if (!$company || !$company->fk_emt_id_changed_password || !$company->emailDefault) {
            // On ne retourne pas d'erreur car cet email est optionnel
            return [
                'success' => true,
                'message' => 'Email de confirmation non envoye (non configure)'
            ];
        }

        // Preparer les donnees pour le template
        $templateData = [
            'user_firstname' => $user->usr_firstname ?? '',
            'user_lastname' => $user->usr_lastname ?? '',
            'user_email' => $user->usr_login,
            'user_fullname' => trim(($user->usr_firstname ?? '') . ' ' . ($user->usr_lastname ?? '')),
            'company_name' => $company->cop_label ?? '',
            'company_phone' => $company->cop_phone ?? '',
            'changed_at' => now()->format('d/m/Y H:i'),
            'user' => [
                'firstname' => $user->usr_firstname ?? '',
                'lastname' => $user->usr_lastname ?? '',
                'email' => $user->usr_login,
            ],
            'company' => [
                'name' => $company->cop_label ?? '',
                'phone' => $company->cop_phone ?? '',
            ]
        ];

        // Parser le template
        $parsedTemplate = $this->templateParser->parseTemplate(
            $company->fk_emt_id_changed_password,
            $templateData
        );

        // Envoyer l'email
        $emailService = new EmailService();
        return $emailService->sendEmail(
            $company->emailDefault,
            $user->usr_login,
            $parsedTemplate['subject'],
            $parsedTemplate['body']
        );
    }
}
