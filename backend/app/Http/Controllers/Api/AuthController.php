<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Models\UserModel;
use App\Services\PasswordResetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

use Exception;

class AuthController extends Controller
{
    /**
     * Register a new user.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $validatedData = $request->validated();

        $user = UserModel::create([
            'usr_login' => $validatedData['email'], // Le login est l'email
            'usr_password' => $validatedData['password'],
            'usr_firstname' => $validatedData['firstname'],
            'usr_lastname' => $validatedData['lastname'],
            'usr_tel' => $validatedData['tel'] ?? null,
            'usr_mobile' => $validatedData['mobile'] ?? null,
            'usr_is_active' => true,
            'usr_failed_login_attempts' => 0,
        ]);

        // Créer un token pour l'utilisateur
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'User registered successfully',
            'user' => [
                'id' => $user->usr_id,
                'login' => $user->usr_login,
                'email' => $user->usr_login, // Le login est l'email
                'firstname' => $user->usr_firstname,
                'lastname' => $user->usr_lastname,
            ],
            'token' => $token,
        ], 201);
    }

    /**
     * Login user and create token.
     */
    public function login(LoginRequest $request): JsonResponse
    {

        $validatedData = $request->validated();      
        $user = UserModel::where('usr_login', $validatedData['login'])
            ->first();

        if (!$user) {
            throw ValidationException::withMessages([
                'login' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->isLocked()) {
            if ($user->usr_permanent_lock) {
                throw ValidationException::withMessages([
                    'login' => ['Your account has been permanently locked. Please contact an administrator.'],
                ]);
            }

            throw ValidationException::withMessages([
                'login' => ['Your account is temporarily locked. Please try again later.'],
            ]);
        }

        if (!$user->usr_is_active) {
            throw ValidationException::withMessages([
                'login' => ['Your account is inactive. Please contact an administrator.'],
            ]);
        }

        if (!Hash::check($validatedData['password'], $user->usr_password)) {
            $user->incrementLoginAttempts();

            throw ValidationException::withMessages([
                'login' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user->resetLoginAttempts();

        DB::table('logs_log')->insert([
            'log_created'     => now(),
            'log_updated'     => now(),
            'fk_usr_id'       => $user->usr_id,
            'log_ip_address'  => $request->ip(),
            'log_user_agent'  => $request->userAgent(),
            'log_action'      => 'login',
            'log_details'     => json_encode(['login' => $user->usr_login]),
        ]);

        // Créer un token d'authentification
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'user' => [
                'id' => $user->usr_id,
                'login' => $user->usr_login,
                'email' => $user->usr_login, // Le login est l'email
                'firstname' => $user->usr_firstname,
                'lastname' => $user->usr_lastname,
                'is_seller' => $user->usr_is_seller,
                'is_technician' => $user->usr_is_technician,
                'roles' => $user->getRoleNames(),
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
            'token' => $token,
        ], 200);
    }

    /**
     * Logout user (revoke token).
     */
    public function logout(Request $request): JsonResponse
    {
        // Révoquer le token actuel de l'utilisateur
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logout successful',
        ], 200);
    }

    /**
     * Get the authenticated user.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => [
                'id' => $user->usr_id,
                'login' => $user->usr_login,
                'email' => $user->usr_login, // Le login est l'email
                'firstname' => $user->usr_firstname,
                'lastname' => $user->usr_lastname,
                'tel' => $user->usr_tel,
                'mobile' => $user->usr_mobile,
                'jobtitle' => $user->usr_jobtitle,
                'is_active' => $user->usr_is_active,
                'is_seller' => $user->usr_is_seller,
                'is_technician' => $user->usr_is_technician,
                'created_at' => $user->created_at,
                'roles' => $user->getRoleNames(),
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ], 200);
    }

    /**
     * Refresh the user's token (revoke old, create new).
     */
    public function refresh(Request $request): JsonResponse
    {
        // Révoquer le token actuel
        $request->user()->currentAccessToken()->delete();

        // Créer un nouveau token
        $token = $request->user()->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Token refreshed successfully',
            'token' => $token,
        ], 200);
    }

    /**
     * Update the authenticated user's profile information.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'firstname' => 'required|string|max:100',
            'lastname'  => 'required|string|max:100',
            'tel'       => 'nullable|string|max:30',
            'mobile'    => 'nullable|string|max:30',
            'jobtitle'  => 'nullable|string|max:150',
        ]);

        $user->update([
            'usr_firstname' => $data['firstname'],
            'usr_lastname'  => $data['lastname'],
            'usr_tel'       => $data['tel'] ?? null,
            'usr_mobile'    => $data['mobile'] ?? null,
            'usr_jobtitle'  => $data['jobtitle'] ?? null,
        ]);

        return response()->json([
            'message' => 'Profil mis à jour.',
            'user' => [
                'id'         => $user->usr_id,
                'login'      => $user->usr_login,
                'email'      => $user->usr_login,
                'firstname'  => $user->usr_firstname,
                'lastname'   => $user->usr_lastname,
                'tel'        => $user->usr_tel,
                'mobile'     => $user->usr_mobile,
                'jobtitle'   => $user->usr_jobtitle,
                'is_seller'      => $user->usr_is_seller,
                'is_technician'  => $user->usr_is_technician,
                'roles'      => $user->getRoleNames(),
                'permissions'=> $user->getAllPermissions()->pluck('name'),
            ],
        ]);
    }

    /**
     * Change the authenticated user's password.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'current_password' => 'required|string',
            'new_password'     => 'required|string|min:8|confirmed',
        ]);

        if (!Hash::check($request->current_password, $user->usr_password)) {
            return response()->json(['message' => 'Le mot de passe actuel est incorrect.'], 422);
        }

        $user->update(['usr_password' => Hash::make($request->new_password)]);

        return response()->json(['message' => 'Mot de passe modifié avec succès.']);
    }

    /**
     * Handle forgot password request.
     * Sends a reset link to the user's email.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $email = $request->input('email');

        // Rechercher l'utilisateur par email (login)
        $user = UserModel::where('usr_login', $email)->first();

        // Pour des raisons de sécurité, on retourne toujours un message de succès
        // même si l'utilisateur n'existe pas
        if (!$user) {
          //  Log::info('Password reset requested for non-existent email: ' . $email);
            return response()->json([
                'message' => 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
            ], 200);
        }

        // Vérifier que le compte est actif
        if (!$user->usr_is_active) {
          //  Log::info('Password reset requested for inactive account: ' . $email);
            return response()->json([
                'message' => 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
            ], 200);
        }

        // Vérifier si le compte est verrouillé définitivement
        if ($user->usr_permanent_lock) {
          //  Log::info('Password reset requested for permanently locked account: ' . $email);
            return response()->json([
                'message' => 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
            ], 200);
        }

        try {
            $passwordResetService = new PasswordResetService();

            // Générer le token de reset
            $token = $passwordResetService->generateResetToken($user);

            // Envoyer l'email de reset
            $result = $passwordResetService->sendResetEmail($user, $token);

            if (!$result['success']) {            
              throw new Exception(  $result['message'], 1);           
            }  

            return response()->json([
                'message' => 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.',
            ], 500);
        }
    }

    /**
     * Handle password reset with token.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $token = $request->input('token');
        $password = $request->input('password');

        $passwordResetService = new PasswordResetService();

        // Valider le token
        $user = $passwordResetService->validateResetToken($token);

        if (!$user) {
            return response()->json([
                'message' => 'Le lien de réinitialisation est invalide ou a expiré.',
            ], 400);
        }

        try {
            // Réinitialiser le mot de passe
            $success = $passwordResetService->resetPassword($user, $password);

            if (!$success) {
                return response()->json([
                    'message' => 'Erreur lors de la réinitialisation du mot de passe.',
                ], 500);
            }

            // Envoyer l'email de confirmation
            $passwordResetService->sendPasswordChangedEmail($user);

            // Révoquer tous les tokens existants
            $user->tokens()->delete();

            Log::info('Password reset successful for: ' . $user->usr_login);

            return response()->json([
                'message' => 'Votre mot de passe a été réinitialisé avec succès.',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Password reset error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Erreur lors de la réinitialisation du mot de passe.',
            ], 500);
        }
    }
}
