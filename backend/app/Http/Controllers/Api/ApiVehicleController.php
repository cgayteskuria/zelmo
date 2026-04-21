<?php

namespace App\Http\Controllers\Api;

use App\Models\VehicleModel;
use App\Models\UserModel;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ApiVehicleController
{
    protected DocumentService $documentService;

    public function __construct(DocumentService $documentService)
    {
        $this->documentService = $documentService;
    }

    /**
     * Liste des vehicules d'un utilisateur
     */
    public function index(Request $request, $userId)
    {
        $query = VehicleModel::forUser($userId)
            ->with('registrationDocument')
            ->orderBy('vhc_is_default', 'desc')
            ->orderBy('vhc_name', 'asc');

        if ($request->filled('active_only')) {
            $query->active();
        }

        $vehicles = $query->get();

        return response()->json([
            'success' => true,
            'data' => $vehicles->map(fn($v) => $this->formatVehicle($v)),
        ]);
    }

    /**
     * Afficher un vehicule
     */
    public function show($userId, $id)
    {
        $vehicle = VehicleModel::forUser($userId)->with('registrationDocument')->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $this->formatVehicle($vehicle),
        ]);
    }

    /**
     * Creer un vehicule pour un utilisateur
     */
    public function store(Request $request, $userId)
    {
        $request->validate([
            'vhc_name' => 'required|string|max:100',
            'vhc_registration' => 'nullable|string|max:20',
            'vhc_fiscal_power' => 'required|integer|between:1,20',
            'vhc_type' => 'required|in:car,motorcycle,moped',
            'vhc_is_active' => 'nullable|boolean',
            'vhc_is_default' => 'nullable|boolean',
            'registration_card' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        // Verifier que l'utilisateur existe
        UserModel::findOrFail($userId);

        $data = $request->only([
            'vhc_name', 'vhc_registration', 'vhc_fiscal_power',
            'vhc_type', 'vhc_is_active', 'vhc_is_default',
        ]);
        $data['fk_usr_id'] = $userId;

        // Carte grise obligatoire pour voiture et moto
        $type = $data['vhc_type'] ?? 'car';
        if (in_array($type, ['car', 'motorcycle']) && !$request->hasFile('registration_card')) {
            return response()->json([
                'message' => 'La carte grise est obligatoire pour les voitures et motos.',
                'errors' => ['registration_card' => ['La carte grise est obligatoire pour les voitures et motos.']],
            ], 422);
        }

        // Un vehicule inactif ne peut pas etre par defaut
        if (empty($data['vhc_is_active']) && !empty($data['vhc_is_default'])) {
            $data['vhc_is_default'] = false;
        }

        // Si defaut, retirer le defaut des autres vehicules
        if (!empty($data['vhc_is_default'])) {
            VehicleModel::forUser($userId)->update(['vhc_is_default' => 0]);
        }

        $vehicle = VehicleModel::create($data);

        // Upload carte grise si fournie
        if ($request->hasFile('registration_card')) {
            $this->documentService->uploadFiles(
                [$request->file('registration_card')],
                'vehicles',
                $vehicle->vhc_id,
                Auth::id()
            );
        }

        $vehicle->load('registrationDocument');

        return response()->json([
            'success' => true,
            'message' => 'Vehicule cree avec succes',
            'data' => $this->formatVehicle($vehicle),
        ], 201);
    }

    /**
     * Mettre a jour un vehicule
     */
    public function update(Request $request, $userId, $id)
    {
        $vehicle = VehicleModel::forUser($userId)->with('registrationDocument')->findOrFail($id);

        $request->validate([
            'vhc_name' => 'sometimes|required|string|max:100',
            'vhc_registration' => 'nullable|string|max:20',
            'vhc_fiscal_power' => 'sometimes|required|integer|between:1,20',
            'vhc_type' => 'sometimes|required|in:car,motorcycle,moped',
            'vhc_is_active' => 'nullable|boolean',
            'vhc_is_default' => 'nullable|boolean',
        ]);

        $data = $request->only([
            'vhc_name', 'vhc_registration', 'vhc_fiscal_power',
            'vhc_type', 'vhc_is_active', 'vhc_is_default',
        ]);

        // Un vehicule inactif ne peut pas etre par defaut
        $isBeingDeactivated = array_key_exists('vhc_is_active', $data) && !$data['vhc_is_active'];

        if ($isBeingDeactivated) {
            $data['vhc_is_default'] = false;
        }

        if (!empty($data['vhc_is_default']) && !$isBeingDeactivated) {
            // Impossible de mettre par defaut un vehicule inactif
            if (!($data['vhc_is_active'] ?? $vehicle->vhc_is_active)) {
                $data['vhc_is_default'] = false;
            } else {
                // Si defaut, retirer le defaut des autres vehicules
                VehicleModel::forUser($userId)
                    ->where('vhc_id', '!=', $id)
                    ->update(['vhc_is_default' => 0]);
            }
        }

        $vehicle->update($data);

        // Si on desactive un vehicule par defaut, reassigner au premier vehicule actif
        if ($isBeingDeactivated && $vehicle->wasChanged('vhc_is_active')) {
            $hasDefault = VehicleModel::forUser($userId)->where('vhc_is_default', true)->exists();
            if (!$hasDefault) {
                $firstActive = VehicleModel::forUser($userId)
                    ->active()
                    ->where('vhc_id', '!=', $id)
                    ->orderBy('vhc_name', 'asc')
                    ->first();

                if ($firstActive) {
                    $firstActive->update(['vhc_is_default' => true]);
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Vehicule mis a jour avec succes',
            'data' => $this->formatVehicle($vehicle->fresh('registrationDocument')),
        ]);
    }

    /**
     * Supprimer un vehicule
     */
    public function destroy($userId, $id)
    {
        $vehicle = VehicleModel::forUser($userId)->findOrFail($id);

        // Verifier qu'il n'est pas utilise dans des frais kilometriques
        if ($vehicle->mileageExpenses()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Ce vehicule est utilise dans des frais kilometriques et ne peut pas etre supprime. Vous pouvez le desactiver.',
            ], 422);
        }

        // Supprimer le document carte grise si existant
        $doc = $vehicle->registrationDocument;
        if ($doc) {
            $this->documentService->deleteDocument($doc, Auth::id());
        }

        $vehicle->delete();

        return response()->json([
            'success' => true,
            'message' => 'Vehicule supprime avec succes',
        ]);
    }

    /**
     * Upload carte grise
     */
    public function uploadRegistration(Request $request, $userId, $id)
    {
        $vehicle = VehicleModel::forUser($userId)->findOrFail($id);

        $request->validate([
            'registration_card' => 'required|file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        // Supprimer l'ancien document si existant
        $oldDoc = $vehicle->registrationDocument;
        if ($oldDoc) {
            $this->documentService->deleteDocument($oldDoc, Auth::id());
        }

        // Upload le nouveau document
        $documents = $this->documentService->uploadFiles(
            [$request->file('registration_card')],
            'vehicles',
            $vehicle->vhc_id,
            Auth::id()
        );

        $doc = $documents->first();

        return response()->json([
            'success' => true,
            'message' => 'Carte grise uploadee avec succes',
            'data' => [
                'id' => $doc->doc_id,
                'fileName' => $doc->doc_filename,
                'fileType' => $doc->doc_filetype,
                'fileSize' => $doc->doc_filesize,
            ],
        ]);
    }

    /**
     * Telecharger carte grise
     */
    public function downloadRegistration($userId, $id)
    {
        $vehicle = VehicleModel::forUser($userId)->with('registrationDocument')->findOrFail($id);

        $doc = $vehicle->registrationDocument;
        if (!$doc) {
            return response()->json([
                'success' => false,
                'message' => 'Aucune carte grise trouvee',
            ], 404);
        }

        $filePath = $this->documentService->getFilePath($doc);

        if (!file_exists($filePath)) {
            return response()->json([
                'success' => false,
                'message' => 'Fichier introuvable',
            ], 404);
        }

        return response()->file($filePath, [
            'Content-Type' => $doc->doc_filetype,
            'Content-Disposition' => 'inline; filename="' . $doc->doc_filename . '"',
        ]);
    }

    /**
     * Supprimer carte grise
     */
    public function deleteRegistration($userId, $id)
    {
        $vehicle = VehicleModel::forUser($userId)->with('registrationDocument')->findOrFail($id);

        $doc = $vehicle->registrationDocument;
        if (!$doc) {
            return response()->json([
                'success' => false,
                'message' => 'Aucune carte grise trouvee',
            ], 404);
        }

        $this->documentService->deleteDocument($doc, Auth::id());

        return response()->json([
            'success' => true,
            'message' => 'Carte grise supprimee avec succes',
        ]);
    }

    /**
     * Options pour select (vehicules actifs d'un utilisateur)
     */
    public function options($userId)
    {
        $vehicles = VehicleModel::forUser($userId)
            ->active()
            ->orderBy('vhc_is_default', 'desc')
            ->orderBy('vhc_name', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $vehicles->map(fn($v) => [
                'id' => $v->vhc_id,
                'label' => $v->vhc_name . ' (' . $v->vhc_fiscal_power . ' CV)',
                'fiscal_power' => $v->vhc_fiscal_power,
                'type' => $v->vhc_type,
                'is_default' => (bool) $v->vhc_is_default,
            ]),
        ]);
    }

    /**
     * Mes vehicules (utilisateur connecte)
     */
    public function myVehicles(Request $request)
    {
        $userId = Auth::id();

        $vehicles = VehicleModel::forUser($userId)
            ->active()
            ->orderBy('vhc_is_default', 'desc')
            ->orderBy('vhc_name', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $vehicles->map(fn($v) => $this->formatVehicle($v)),
        ]);
    }

    /**
     * Options de mes vehicules (utilisateur connecte)
     */
    public function myVehiclesOptions(Request $request)
    {
        $userId = Auth::id();

        $vehicles = VehicleModel::forUser($userId)
            ->active()
            ->orderBy('vhc_is_default', 'desc')
            ->orderBy('vhc_name', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $vehicles->map(fn($v) => [
                'id' => $v->vhc_id,
                'label' => $v->vhc_name . ' (' . $v->vhc_fiscal_power . ' CV)',
                'fiscal_power' => $v->vhc_fiscal_power,
                'type' => $v->vhc_type,
                'is_default' => (bool) $v->vhc_is_default,
            ]),
        ]);
    }

    /**
     * Formatter un vehicule
     */
    private function formatVehicle(VehicleModel $vehicle): array
    {
        $doc = $vehicle->relationLoaded('registrationDocument') ? $vehicle->registrationDocument : null;

        return [
            'id' => $vehicle->vhc_id,
            'vhc_id' => $vehicle->vhc_id,
            'fk_usr_id' => $vehicle->fk_usr_id,
            'vhc_name' => $vehicle->vhc_name,
            'vhc_registration' => $vehicle->vhc_registration,
            'vhc_fiscal_power' => $vehicle->vhc_fiscal_power,
            'vhc_type' => $vehicle->vhc_type,
            'vhc_is_active' => (bool) $vehicle->vhc_is_active,
            'vhc_is_default' => (bool) $vehicle->vhc_is_default,
            'registration_document' => $doc ? [
                'id' => $doc->doc_id,
                'fileName' => $doc->doc_filename,
                'fileType' => $doc->doc_filetype,
                'fileSize' => $doc->doc_filesize,
            ] : null,
        ];
    }
}
