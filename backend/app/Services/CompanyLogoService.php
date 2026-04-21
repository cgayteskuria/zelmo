<?php

namespace App\Services;

use App\Models\CompanyModel;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class CompanyLogoService
{
    /**
     * Récupère le logo de l'entreprise en base64
     * 
     * @param string $logoType 'large', 'square', ou 'printable'
     * @return string|null
     */
    public function getLogoBase64(string $logoType = 'large'): ?string
    {
        $cacheKey = "company_logo_base64_{$logoType}";
        
        return Cache::remember($cacheKey, 3600, function () use ($logoType) {
            $company = CompanyModel::with([
                'logoLarge',
                'logoSquare',
                'logoPrintable'
            ])->first();
            
            if (!$company) {
                return null;
            }
            
            // Sélectionner le bon logo selon le type
            $logo = match($logoType) {
                'large' => $company->logoLarge,
                'square' => $company->logoSquare,
                'printable' => $company->logoPrintable,
                default => $company->logoSquare,
            };
            
            if (!$logo || !$logo->doc_filepath) {
                return null;
            }
            
            // Construire le chemin complet
            $filePath = storage_path('app/' . $logo->doc_filepath);
            
            // Vérifier si le fichier existe
            if (!file_exists($filePath)) {               
                return null;
            }
            
            // Encoder en base64
            try {
                $imageData = base64_encode(file_get_contents($filePath));
                $mimeType = $logo->doc_filetype ?? 'image/png';
                
                return "data:{$mimeType};base64,{$imageData}";
            } catch (\Exception $e) {             
                return null;
            }
        });
    }
    
    /**
     * Récupère les informations du logo (pour URL publique)
     * 
     * @param string $logoType
     * @return array|null
     */
    public function getLogoInfo(string $logoType = 'square'): ?array
    {
        $company = CompanyModel::with([
            'logoLarge',
            'logoSquare',
            'logoPrintable'
        ])->first();
        
        if (!$company) {
            return null;
        }
        
        $logo = match($logoType) {
            'large' => $company->logoLarge,
            'square' => $company->logoSquare,
            'printable' => $company->logoPrintable,
            default => $company->logoSquare,
        };
        
        if (!$logo) {
            return null;
        }
        
        return [
            'id' => $logo->doc_id,
            'filename' => $logo->doc_filename,
            'filetype' => $logo->doc_filetype,
            'filepath' => $logo->doc_filepath,
        ];
    }
    
    /**
     * Invalide le cache des logos
     */
    public function clearCache(): void
    {
        Cache::forget('company_logo_base64_large');
        Cache::forget('company_logo_base64_square');
        Cache::forget('company_logo_base64_printable');
    }
}