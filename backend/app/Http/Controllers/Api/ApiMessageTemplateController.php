<?php

namespace App\Http\Controllers\Api;

use App\Models\MessageTemplateModel;
use App\Models\SaleConfigModel;
use App\Models\InvoiceConfigModel;
use App\Models\SaleOrderModel;
use App\Models\InvoiceModel;
use App\Models\CompanyModel;
use App\Services\TemplateParserService;
use App\Services\DocumentService;
use App\Traits\HasGridFilters;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ApiMessageTemplateController extends Controller
{
    use HasGridFilters;

    public function index(Request $request): JsonResponse
    {
        $gridKey = 'message-templates';

        // --- Gestion des grid settings ---
        if (!$request->has('sort_by')) {
            $saved = $this->loadGridSettings($gridKey);
            if ($saved) {
                $merge = [];
                if (!empty($saved['sort_by']))    $merge['sort_by']    = $saved['sort_by'];
                if (!empty($saved['sort_order'])) $merge['sort_order'] = $saved['sort_order'];
                if (!empty($saved['filters']))    $merge['filters']    = $saved['filters'];
                if (!empty($saved['page_size']))  $merge['limit']      = $saved['page_size'];
                $request->merge($merge);
            }
        }

        $query = MessageTemplateModel::query()
            ->select([
                'emt_id as id',
                'emt_label',
                'emt_category',
                'emt_subject',
            ]);

        // Filtre par catégorie (filtre fixe, pas via HasGridFilters)
        if ($request->has('emt_category')) {
            $query->where('emt_category', $request->input('emt_category'));
        }

        $this->applyGridFilters($query, $request, [
            'emt_label'   => 'emt_label',
            'emt_subject' => 'emt_subject',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'          => 'emt_id',
            'emt_label'   => 'emt_label',
            'emt_subject' => 'emt_subject',
        ], 'emt_label', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'emt_label'),
            'sort_order' => strtoupper($request->input('sort_order', 'ASC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];

        $this->saveGridSettings($gridKey, $currentSettings);

        return response()->json([
            'data'         => $query->get(),
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }

    /**
     * Display the specified message template.
     */
    public function show($id): JsonResponse
    {
        $template = MessageTemplateModel::findOrFail($id);

        return response()->json([
            'data' => $template
        ], 200);
    }

    /**
     * Store a newly created message template.
     */
    public function store(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'emt_label'    => 'required|string|max:255',
            'emt_category' => 'required|in:ticket_reply,system',
            'emt_subject'  => 'required|string|max:255',
            'emt_body'     => 'required|string',
        ]);

        $template = MessageTemplateModel::create($validatedData);

        return response()->json([
            'message' => 'Modèle créé avec succès',
            'data' => $template,
        ], 201);
    }

    /**
     * Update the specified message template.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $template = MessageTemplateModel::findOrFail($id);

        $validatedData = $request->validate([
            'emt_label'    => 'required|string|max:255',
            'emt_category' => 'required|in:ticket_reply,system',
            'emt_subject'  => 'required|string|max:255',
            'emt_body'     => 'required|string',
        ]);

        $template->update($validatedData);

        return response()->json([
            'message' => 'Modèle mis à jour avec succès',
            'data' => $template,
        ]);
    }

    /**
     * Remove the specified message template.
     */
    public function destroy($id): JsonResponse
    {
        $template = MessageTemplateModel::findOrFail($id);
        $template->delete();

        return response()->json([
            'message' => 'Modèle supprimé avec succès',
        ]);
    }

    /**
     * Get options for select dropdown.
     */
    public function options(): JsonResponse
    {
        $templates = MessageTemplateModel::select('emt_id as id', 'emt_label as label')
            ->orderBy('emt_label')
            ->get();

        return response()->json(['data' => $templates]);
    }

    /**
     * Recherche de templates pour le module tickets (permission: tickets.view)
     */
    public function forTickets(Request $request): JsonResponse
    {
        $query = MessageTemplateModel::query()
            ->select('emt_id as id', 'emt_label as name', 'emt_category as category', 'emt_body as body');

        if ($request->filled('emt_category')) {
            $query->where('emt_category', $request->input('emt_category'));
        }

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->where('emt_label', 'LIKE', '%' . $s . '%')
                  ->orWhere('emt_body', 'LIKE', '%' . $s . '%');
            });
        }

        $data = $query->orderBy('emt_label')->limit(30)->get();

        return response()->json(['data' => $data]);
    }

    /**
     * Parse un template avec les données fournies.
     *
     * @param Request $request
     *   - context: 'sale' ou 'invoice'
     *   - template_type: suffixe du champ fk_emt_id (ex: 'sale', 'sale_validation', 'invoice')
     *   - document_id: ID du document (ord_id ou inv_id) pour charger les données automatiquement
     *   - data: données supplémentaires pour le remplacement des variables (optionnel)
     */
    public function parse(Request $request): JsonResponse
    {
        $validatedData = $request->validate([
            'context' => 'required|in:sale,invoice',
            'template_type' => 'required|string',
            'document_id' => 'nullable|integer',
            'data' => 'nullable|array',
        ]);

        $context = $validatedData['context'];
        $templateType = $validatedData['template_type'];
        $documentId = $validatedData['document_id'] ?? null;
        $data = $validatedData['data'] ?? [];

        // Récupérer le template ID depuis la configuration appropriée
        $templateId = null;

        if ($context === 'sale') {
            $config = SaleConfigModel::first();
            if ($config) {
                $fieldName = 'fk_emt_id_' . $templateType;
                $templateId = $config->{$fieldName} ?? null;
            }
        } elseif ($context === 'invoice') {
            $config = InvoiceConfigModel::first();
            if ($config) {
                if ($config) {
                    $fieldName = 'fk_emt_id_' . $templateType;
                    $templateId = $config->{$fieldName} ?? null;
                }
            }
        }

        if (!$templateId) {
            return response()->json([
                'success' => false,
                'message' => 'Template non trouvé pour ce contexte et type'
            ], 404);
        }

        // Si un document_id est fourni, charger les données du document
        if ($documentId) {
            $documentData = $this->buildDocumentData($context, $documentId);
            // Fusionner avec les données passées en paramètre (les données passées ont priorité)
            $data = array_merge($documentData, $data);
        }

        // Parser le template
        $parserService = new TemplateParserService();
        $result = $parserService->parseTemplate($templateId, $data);

        return response()->json([
            'success' => true,
            'data' => [
                'subject' => $result['subject'],
                'body' => $result['body'],
                'template_id' => $templateId
            ]
        ]);
    }

    /**
     * Construit les données du document pour le parsing du template.
     * Délègue à TemplateParserService::buildData().
     */
    private function buildDocumentData(string $context, int $documentId): array
    {
        $data = [];

        return TemplateParserService::buildData($context, $documentId);
    }
}
