<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\DeviceModel;
use App\Models\ContactDeviceModel;
use App\Traits\HasGridFilters;


class ApiDeviceController extends Controller
{
    use HasGridFilters;

    /**
     * Display a listing of the resource.
     * Support de la pagination serveur, du tri et des filtres via HasGridFilters.
     */
    public function index(Request $request)
    {
        $gridKey = 'devices';

        // Chargement initial : restaurer les settings sauvegardés
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

        $query = DeviceModel::from('device_dev as dev')
            ->leftJoin('partner_ptr as ptr', 'dev.fk_ptr_id', '=', 'ptr.ptr_id')
            ->select([
                'dev.dev_id as id',
                'ptr.ptr_name',
                'dev.dev_hostname',
                'dev.dev_lastloggedinuser',
                'dev.dev_os',
                'dev.dev_lastseen',
            ]);

        $columnMap = [
            'id'                   => 'dev.dev_id',
            'ptr_name'             => 'ptr.ptr_name',
            'dev_hostname'         => 'dev.dev_hostname',
            'dev_lastloggedinuser' => 'dev.dev_lastloggedinuser',
            'dev_os'               => 'dev.dev_os',
            'dev_lastseen'         => 'dev.dev_lastseen',
        ];

        $this->applyGridFilters($query, $request, $columnMap);

        $total = $query->count();

        $this->applyGridSort($query, $request, $columnMap, 'dev_hostname', 'ASC');
        $this->applyGridPagination($query, $request);

        $data = $query->get();

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'dev_hostname'),
            'sort_order' => strtoupper($request->input('sort_order', 'ASC')),
            'filters'    => $request->input('filters', []),
            'page_size'  => (int) $request->input('limit', 50),
        ];

        $this->saveGridSettings($gridKey, $currentSettings);

        return response()->json([
            'data'         => $data,
            'total'        => $total,
            'gridSettings' => $currentSettings,
        ]);
    }

    /**
     * Récupère les partenaires sous forme d'options pour un Select
     * Support des filtres : is_customer, is_supplier, is_prospect, is_active
     */
    public function options(Request $request)
    {

        $request->validate([
            //'q'                 => 'nullable|string',
            'search'            => 'nullable|string|max:100',
            'is_active'         => 'nullable|boolean',
            'dev_id'            => 'nullable|integer',
            'dev_hostname'      => 'nullable|string',
            'dev_lastloggedinuser' => 'nullable|string',
            'excludedIds'       => 'nullable|array',
            'ptrId'            => 'nullable|integer'
            // 'excludedIds.*'     => 'integer',
        ]);


        $query = DeviceModel::from('device_dev as dev')
            ->select([
                'dev.dev_id as id',
                DB::raw("
                CONCAT(
                    COALESCE(dev.dev_hostname, ''),
                    IF(dev.dev_lastloggedinuser IS NOT NULL 
                        AND dev.dev_lastloggedinuser != '',
                        CONCAT(' (', dev.dev_lastloggedinuser, ')'),
                        ''
                    )
                ) as label
            ")
            ]);

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('dev.dev_hostname', 'LIKE', "%{$search}%")
                  ->orWhere('dev.dev_lastloggedinuser', 'LIKE', "%{$search}%");
            });
        }

        /**
         * Mapping des filtres
         */
        if ($request->filled('is_active')) {
            $query->where('dev.dev_is_active', (int) $request->input('is_active'));
        }

        if ($request->filled('dev_id')) {
            $query->where('dev.dev_id', (int) $request->input('dev_id'));
        }

        if ($request->filled('dev_hostname')) {
            $query->where('dev.dev_hostname', $request->input('dev_hostname'));
        }

        if ($request->filled('dev_lastloggedinuser')) {
            $query->where('dev.dev_lastloggedinuser', $request->input('dev_lastloggedinuser'));
        }
        if ($request->filled('ptrId')) {
            $query->where('dev.fk_ptr_id', (int) $request->input('ptrId'));
        }
        /**
         * Exclusion d’IDs
         */
        if ($request->filled('excludedIds')) {
            $query->whereNotIn('dev.dev_id', $request->input('excludedIds'));
        }
        $data = $query->orderByRaw("
            CONCAT(
                COALESCE(dev.dev_hostname, ''),
                IF(dev.dev_lastloggedinuser IS NOT NULL 
                    AND dev.dev_lastloggedinuser != '',
                    CONCAT(' (', dev.dev_lastloggedinuser, ')'),
                    ''
                )
            ) ASC
        ")->get();

        return response()->json([
            'data' => $data
        ]);
    }

    /**
     * Display the specified tax.
     */
    public function show($id)
    {
        $data = DeviceModel::with([
            'partner:ptr_id,ptr_name',
        ])
            ->where('dev_id', $id)->firstOrFail();

        if (!$data) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found'
            ], 404);
        }
        return response()->json([
            'status' => true,
            'data' => $data
        ], 200);
    }

    /**
     * Récupérer les contacts d'un device
     * @param int $deviceId - ID du device
     */
    public function getContacts($deviceId)
    {
        $contacts = DB::table('contact_device_ctd as ctd')
            ->leftJoin('contact_ctc as ctc', 'ctd.fk_ctc_id', '=', 'ctc.ctc_id')
            ->where('ctd.fk_dev_id', $deviceId)
            ->select(
                'ctd.ctd_id',
                'ctd.fk_ctc_id',
                'ctc.ctc_firstname',
                'ctc.ctc_lastname',
                'ctc.ctc_email',
                'ctc.ctc_phone',
                'ctc.ctc_mobile',
                'ctc.ctc_job_title'
            )
            ->orderBy('ctc.ctc_lastname', 'asc')
            ->get();

        return response()->json([
            'data' => $contacts
        ]);
    }

    /**
     * Lier un contact à un device
     * @param Request $request
     * @param int $deviceId - ID du device
     */
    public function linkContact(Request $request, $deviceId)
    {
        $validatedData = $request->validate([
            'contact_id' => 'required|integer|exists:contact_ctc,ctc_id'
        ]);

        // Vérifier si la liaison existe déjà
        $exists = ContactDeviceModel::where('fk_dev_id', $deviceId)
            ->where('fk_ctc_id', $validatedData['contact_id'])
            ->exists();

        if ($exists) {
            return response()->json([
                'status'  => false,
                'message' => 'Ce contact est déjà lié à ce device'
            ], 400);
        }

        // Créer la liaison
        ContactDeviceModel::create([
            'fk_dev_id' => $deviceId,
            'fk_ctc_id' => $validatedData['contact_id'],
        ]);

        return response()->json([
            'status'  => true,
            'message' => 'Contact lié avec succès'
        ]);
    }

    /**
     * Délier un contact d'un device
     * @param int $deviceId - ID du device
     * @param int $ctdId - ID de la liaison contact_device
     */
    public function unlinkContact($deviceId, $ctdId)
    {
        $deleted = ContactDeviceModel::where('ctd_id', $ctdId)
            ->where('fk_dev_id', $deviceId)
            ->delete();

        if (!$deleted) {
            return response()->json([
                'status'  => false,
                'message' => 'Liaison introuvable'
            ], 404);
        }

        return response()->json([
            'status'  => true,
            'message' => 'Contact délié avec succès'
        ]);
    }
}
