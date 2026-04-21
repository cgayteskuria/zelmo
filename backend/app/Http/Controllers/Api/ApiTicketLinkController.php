<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use App\Models\TicketLinkModel;
use App\Models\TicketModel;

class ApiTicketLinkController 
{
    /**
     * Liste des tickets liés à un ticket donné
     */
    public function index($ticketId)
    {
        $links = TicketLinkModel::where('fk_tkt_id_from', $ticketId)
            ->orWhere('fk_tkt_id_to', $ticketId)
            ->with([
                'ticketFrom' => fn($q) => $q->select('tkt_id', 'tkt_label')->with('status:tke_id,tke_label,tke_color'),
                'ticketTo'   => fn($q) => $q->select('tkt_id', 'tkt_label')->with('status:tke_id,tke_label,tke_color'),
            ])
            ->get()
            ->map(function ($link) use ($ticketId) {
                $other = $link->fk_tkt_id_from == $ticketId ? $link->ticketTo : $link->ticketFrom;
                return [
                    'tkl_id'   => $link->tkl_id,
                    'tkl_type' => $link->tkl_type,
                    'ticket'   => $other,
                ];
            });

        return response()->json(['data' => $links]);
    }

    /**
     * Créer un lien entre deux tickets
     */
    public function store(Request $request)
    {
        $ticketId = $request->route('ticketId');

        $validated = $request->validate([
            'fk_tkt_id_to' => 'required|integer|exists:ticket_tkt,tkt_id',
            'tkl_type'     => 'sometimes|string|max:50',
        ]);

        if ((int) $validated['fk_tkt_id_to'] === (int) $ticketId) {
            return response()->json(['success' => false, 'message' => 'Un ticket ne peut pas être lié à lui-même'], 422);
        }

        $existing = TicketLinkModel::where(function ($q) use ($ticketId, $validated) {
            $q->where('fk_tkt_id_from', $ticketId)
              ->where('fk_tkt_id_to', $validated['fk_tkt_id_to']);
        })->orWhere(function ($q) use ($ticketId, $validated) {
            $q->where('fk_tkt_id_from', $validated['fk_tkt_id_to'])
              ->where('fk_tkt_id_to', $ticketId);
        })->first();

        if ($existing) {
            return response()->json(['success' => false, 'message' => 'Lien déjà existant'], 422);
        }

        $link = new TicketLinkModel();
        $link->fk_tkt_id_from = $ticketId;
        $link->fk_tkt_id_to   = $validated['fk_tkt_id_to'];
        $link->tkl_type        = $validated['tkl_type'] ?? 'related';
        $link->tkl_created     = now();
        $link->save();

        return response()->json(['success' => true, 'data' => ['tkl_id' => $link->tkl_id]]);
    }

    /**
     * Supprimer un lien
     */
    public function destroy($ticketId, $linkId)
    {
       
        $link = TicketLinkModel::where('tkl_id', $linkId)
            ->where(function ($q) use ($ticketId) {
                $q->where('fk_tkt_id_from', $ticketId)
                  ->orWhere('fk_tkt_id_to', $ticketId);
            })->first();

        if (!$link) {
            return response()->json(['success' => false, 'message' => 'Lien non trouvé'], 404);
        }

        $link->delete();
        return response()->json(['success' => true]);
    }
}
