<?php

namespace App\Http\Controllers\Api;

use App\Services\SignatureService;
use App\Models\SaleConfigModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class ApiSignatureController extends Controller
{
    public function __construct(private SignatureService $signatureService) {}

    /**
     * GET /api/public/sign/{token}
     * Retourne les données du document à signer (public, sans auth).
     */
    public function showSigningPage(string $token): JsonResponse
    {
        try {
            $data = $this->signatureService->resolveToken($token);
            return response()->json(['success' => true, 'data' => $data]);
        } catch (\Exception $e) {
            $status = $e->getCode() === 410 ? 410 : ($e->getCode() === 404 ? 404 : 500);
            return response()->json(['success' => false, 'message' => $e->getMessage()], $status);
        }
    }

    /**
     * POST /api/public/sign/{token}
     * Soumet la signature du client (public, sans auth).
     */
    public function sign(Request $request, string $token): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'signature_image'  => 'required|string',
            'cgv_accepted'     => 'required|boolean|accepted',
            'cgv_version'      => 'required|string',
            'signer_firstname' => 'nullable|string|max:100',
            'signer_lastname'  => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        try {
            $this->signatureService->processSignature($token, [
                'signature_image'  => $request->input('signature_image'),
                'cgv_accepted'     => (bool) $request->input('cgv_accepted'),
                'cgv_version'      => $request->input('cgv_version'),
                'signer_firstname' => trim($request->input('signer_firstname', '')),
                'signer_lastname'  => trim($request->input('signer_lastname', '')),
                'ip'               => $request->ip(),
                'user_agent'       => $request->userAgent() ?? '',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Document signé avec succès. Un email de confirmation vous a été envoyé.',
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            $status = $e->getCode() === 410 ? 410 : ($e->getCode() === 404 ? 404 : 500);
            Log::error('Signature error', ['token' => $token, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], $status);
        }
    }

    /**
     * POST /api/sale-orders/{id}/send-signature-request
     * POST /api/contracts/{id}/send-signature-request
     * Génère le token et envoie l'email de demande de signature (auth requise).
     */
    /**
     * GET /api/public/cgv
     * Sert le fichier PDF des CGV (public, sans auth).
     */
    public function serveCgv(): \Symfony\Component\HttpFoundation\StreamedResponse|\Illuminate\Http\JsonResponse
    {
        $config = SaleConfigModel::first();

        if (!$config || !$config->sco_cgv_path || !Storage::disk('private')->exists($config->sco_cgv_path)) {
            return response()->json(['success' => false, 'message' => 'CGV non disponibles.'], 404);
        }

        return Storage::disk('private')->response($config->sco_cgv_path, 'CGV.pdf', [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="CGV.pdf"',
        ]);
    }

    /**
     * POST /api/sale-orders/{id}/prepare-signature
     * Génère le token et gèle le PDF sans envoyer l'email.
     * Retourne la signature_url pour pré-remplir un email personnalisé.
     */
    public function prepareToken(Request $request, int $id): JsonResponse
    {
        $docType = $request->route()->parameter('docType', 'sale_order');

        try {
            $result = $this->signatureService->prepareSignatureToken($docType, $id, Auth::id());

            return response()->json([
                'success' => true,
                'data'    => [
                    'signature_url'    => $result['sign_url'],
                    'sign_expires_at'  => $result['sign_expires_at'],
                    'sign_expires_str' => $result['sign_expires_str'],
                ],
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            Log::error('prepareSignatureToken error', ['docType' => $docType, 'id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * PATCH /api/sale-orders/{id}/signature-signer-email
     * PATCH /api/contracts/{id}/signature-signer-email
     * Stocke l'email du signataire après envoi via le dialog email.
     */
    public function storeSignerEmail(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'signer_email' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => $validator->errors()->first()], 422);
        }

        $docType = $request->route()->parameter('docType', 'sale_order');

        try {
            $this->signatureService->storeSignerEmail($docType, $id, $request->input('signer_email'));
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::error('storeSignerEmail error', ['docType' => $docType, 'id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/sale-orders/{id}/send-signature-request
     * POST /api/contracts/{id}/send-signature-request
     * Génère le token et envoie l'email de demande de signature (auth requise).
     */
    public function sendRequest(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'to_email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $docType = $request->route()->parameter('docType', 'sale_order');

        try {
            $result = $this->signatureService->generateSignatureRequest(
                $docType,
                $id,
                $request->input('to_email'),
                Auth::id()
            );

            return response()->json([
                'success' => true,
                'message' => 'Demande de signature envoyée à ' . $request->input('to_email'),
                'data'    => ['expires_at' => $result['expires_at']],
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            Log::error('sendSignatureRequest error', ['docType' => $docType, 'id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}
