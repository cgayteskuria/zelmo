<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\ContactModel;
use App\Models\ContactDeviceModel;
use App\Traits\HasGridFilters;


class ApiContactController extends Controller
{
    use HasGridFilters;

    public function index(Request $request)
    {
        $gridKey = 'contacts';

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

        $deviceSubQuery = DB::table('contact_device_ctd as ctd')
            ->leftJoin('device_dev as dev', 'ctd.fk_dev_id', '=', 'dev.dev_id')
            ->select(
                'ctd.fk_ctc_id',
                DB::raw('GROUP_CONCAT(DISTINCT dev.dev_hostname) AS devices')
            )
            ->groupBy('ctd.fk_ctc_id');

        $query = ContactModel::from('contact_ctc as ctc')
            ->leftJoin('partner_ptr as ptr', 'ctc.fk_ptr_id', '=', 'ptr.ptr_id')
            ->leftJoinSub($deviceSubQuery, 'dvc', function ($join) {
                $join->on('ctc.ctc_id', '=', 'dvc.fk_ctc_id');
            })
            ->select([
                'ctc.ctc_id as id',
                'ptr.ptr_name',
                'ctc.ctc_firstname',
                'ctc.ctc_lastname',
                'ctc.ctc_email',
                'ctc.ctc_phone',
                'ctc.ctc_mobile',
                DB::raw("COALESCE(dvc.devices, '') AS devices"),
            ]);

        $this->applyGridFilters($query, $request, [
            'ptr_name'      => 'ptr.ptr_name',
            'ctc_firstname' => 'ctc.ctc_firstname',
            'ctc_lastname'  => 'ctc.ctc_lastname',
            'ctc_email'     => 'ctc.ctc_email',
        ]);

        $total = $query->count();

        $this->applyGridSort($query, $request, [
            'id'            => 'ctc.ctc_id',
            'ptr_name'      => 'ptr.ptr_name',
            'ctc_firstname' => 'ctc.ctc_firstname',
            'ctc_lastname'  => 'ctc.ctc_lastname',
            'ctc_email'     => 'ctc.ctc_email',
        ], 'ctc_firstname', 'ASC');

        $this->applyGridPagination($query, $request, 50);

        $currentSettings = [
            'sort_by'    => $request->input('sort_by', 'ctc_firstname'),
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
     * Récupère les contacts sous forme d'options pour un Select
     * Support des filtres : is_active, ptrId, excludedIds, search
     */
    public function options(Request $request)
    {
        $request->validate([
            'is_active'     => 'nullable',
            'ctc_id'        => 'nullable|integer',
            'search'        => 'nullable|string|min:2',
            'excludeIds'    => 'nullable|array',
            'ptrId'         => 'nullable|integer',
            'receive_saleorder' => 'nullable',
            'receive_invoice'   => 'nullable',
        ]);

        $query = ContactModel::from('contact_ctc as ctc')
            ->leftJoin('partner_ptr as ptr', 'ctc.fk_ptr_id', '=', 'ptr.ptr_id')
            ->whereNotNull('ctc.ctc_email')
            ->where('ctc.ctc_email', '!=', '')
            ->select([
                'ctc.ctc_id as id',
                'ctc.ctc_email as email',
                DB::raw("TRIM(CONCAT_WS(' ', ctc_firstname, ctc_lastname)) as name"),
                DB::raw("TRIM(CONCAT_WS(' ', ctc_firstname, ctc_lastname, ctc_email)) as label"),
                'ptr.ptr_name as partner_name',
            ]);

        // Filtre par ID
        if ($request->filled('ctc_id')) {
            $query->where('ctc.ctc_id', (int) $request->input('ctc_id'));
        }

        // Recherche globale (nom, prénom, email)
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('ctc.ctc_email', 'LIKE', '%' . $search . '%')
                    ->orWhere('ctc.ctc_firstname', 'LIKE', '%' . $search . '%')
                    ->orWhere('ctc.ctc_lastname', 'LIKE', '%' . $search . '%');
            });
        }

        if ($request->has('is_active')) {
            $query->where('ctc.ctc_is_active', (int) $request->input('is_active'));
        }

        if ($request->has('receive_saleorder')) {
            $query->where('ctc.ctc_receive_saleorder', (int) $request->input('receive_saleorder'));         
        }

        if ($request->has('receive_invoice')) {
            $query->where('ctc.ctc_receive_invoice', (int) $request->input('receive_invoice'));
        }

        // Filtre par partenaire (via pivot many-to-many)
        if ($request->filled('ptrId')) {
            $ptrId = (int) $request->input('ptrId');
            $query->whereExists(function ($sub) use ($ptrId) {
                $sub->select(DB::raw(1))
                    ->from('contact_partner_ctp as ctp')
                    ->whereColumn('ctp.fk_ctc_id', 'ctc.ctc_id')
                    ->where('ctp.fk_ptr_id', $ptrId);
            });
        }

        // Exclusion d'IDs
        if ($request->filled('excludeIds')) {
            $query->whereNotIn('ctc.ctc_id', $request->input('excludeIds'));
        }

        $data = $query->orderBy('ctc_firstname')->limit(20)->get();

        return response()->json([
            'data' => $data
        ]);
    }

    /**
     * Display the specified contact avec ses partenaires.
     */
    public function show($id)
    {
        $data = ContactModel::with([
            'partner:ptr_id,ptr_name',
            'partners:ptr_id,ptr_name',
        ])->where('ctc_id', $id)->firstOrFail();

        $result = $data->toArray();
        $result['partner_ids'] = $data->partners->pluck('ptr_id')->toArray();

        return response()->json([
            'status' => true,
            'data' => $result
        ], 200);
    }

    /**
     * Récupérer les contacts d'un partenaire (via pivot)
     */
    public function getByPartner($partnerId)
    {
        $contacts = ContactModel::whereHas('partners', function ($q) use ($partnerId) {
            $q->where('ptr_id', (int) $partnerId);
        })
            ->select(
                'ctc_id as id',
                'ctc_firstname',
                'ctc_lastname',
                'ctc_email',
                'ctc_phone',
                'ctc_mobile',
                'ctc_job_title'
            )
            ->orderBy('ctc_lastname', 'asc')
            ->get();

        return response()->json([
            'data' => $contacts
        ]);
    }

    /**
     * Création d'un contact avec sync des partenaires
     */
    public function store(Request $request)
    {
        try {
            $data = $request->all();
            $partnerIds = $data['partner_ids'] ?? [];
            $data['fk_ptr_id'] = !empty($partnerIds) ? $partnerIds[0] : null;
            unset($data['partner_ids']);

            $contact = new ContactModel();
            $contact->updateSafe($data);
            $contact->partners()->sync($partnerIds);

            return response()->json([
                'success' => true,
                'message' => 'Created successfully',
                'data' => ['ctc_id' => $contact->ctc_id],
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    /**
     * Mise à jour d'un contact avec sync des partenaires
     */
    public function update(Request $request, $id)
    {
        $contact = ContactModel::find($id);
        if (!$contact) {
            return response()->json(['success' => false, 'message' => 'Item not found'], 404);
        }

        $data = $request->all();
        $partnerIds = $data['partner_ids'] ?? null;
        unset($data['partner_ids']);

        if ($partnerIds !== null) {
            $data['fk_ptr_id'] = !empty($partnerIds) ? $partnerIds[0] : null;
            $contact->partners()->sync($partnerIds);
        }

        $contact->updateSafe($data);

        return response()->json([
            'success' => true,
            'message' => 'Updated successfully',
            'data' => ['ctc_id' => $contact->ctc_id],
        ]);
    }

    /**
     * Rattacher un contact existant à un partenaire supplémentaire (via pivot)
     */
    public function attachPartner(Request $request, $contactId)
    {
        $validated = $request->validate([
            'ptr_id' => 'required|integer|exists:partner_ptr,ptr_id',
        ]);

        $contact = ContactModel::findOrFail($contactId);
        $contact->partners()->syncWithoutDetaching([$validated['ptr_id']]);

        // Mettre à jour fk_ptr_id si vide (backward compat)
        if (!$contact->fk_ptr_id) {
            $contact->fk_ptr_id = $validated['ptr_id'];
            $contact->save();
        }

        return response()->json([
            'success' => true,
            'data' => ['ctc_id' => $contact->ctc_id],
        ]);
    }

    /**
     * Récupérer les devices d'un contact
     */
    public function getDevices($contactId)
    {
        $devices = DB::table('contact_device_ctd as ctd')
            ->leftJoin('device_dev as dev', 'ctd.fk_dev_id', '=', 'dev.dev_id')
            ->where('ctd.fk_ctc_id', $contactId)
            ->select(
                'ctd.ctd_id',
                'ctd.fk_dev_id',
                'dev.dev_hostname',
                'dev.dev_lastloggedinuser',
                'dev.dev_os',
                'dev.dev_dattowebremoteurl',
                'dev.dev_lastseen'
            )
            ->get();

        return response()->json([
            'data' => $devices
        ]);
    }
    /**
     * Lier un device à un contact
     */
    public function linkDevice(Request $request, $contactId)
    {
        $validatedData = $request->validate([
            'device_id' => 'required|integer|exists:device_dev,dev_id'
        ]);

        $exists = ContactDeviceModel::where('fk_ctc_id', $contactId)
            ->where('fk_dev_id', $validatedData['device_id'])
            ->exists();

        if ($exists) {
            return response()->json([
                'status'  => false,
                'message' => 'Ce device est déjà lié à ce contact'
            ], 400);
        }

        ContactDeviceModel::create([
            'fk_ctc_id' => $contactId,
            'fk_dev_id' => $validatedData['device_id'],
        ]);

        return response()->json([
            'status'  => true,
            'message' => 'Device lié avec succès'
        ]);
    }

    /**
     * Délier un device d'un contact
     */
    public function unlinkDevice($contactId, $ctdId)
    {
        $deleted = ContactDeviceModel::where('ctd_id', $ctdId)
            ->where('fk_ctc_id', $contactId)
            ->delete();

        if (!$deleted) {
            return response()->json([
                'status'  => false,
                'message' => 'Liaison introuvable'
            ], 404);
        }

        return response()->json([
            'status'  => true,
            'message' => 'Device délié avec succès'
        ]);
    }
}
