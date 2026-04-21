<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiDashboardController extends Controller
{
    /**
     * Activité récente multi-modules (agrégée selon les permissions).
     * Retourne les N événements les plus récents accessibles à l'utilisateur.
     */
    public function activity(Request $request)
    {
        $user = $request->user();
        $activities = collect();

        // ── Tickets récents ──────────────────────────────────────
        if ($user->can('tickets.view')) {
            $tickets = DB::table('ticket_tkt as tkt')
                ->leftJoin('partner_ptr as ptr', 'tkt.fk_ptr_id', '=', 'ptr.ptr_id')
                ->leftJoin('ticket_status_tke as tke', 'tkt.fk_tke_id', '=', 'tke.tke_id')
                ->leftJoin('user_usr as usr', 'tkt.fk_usr_id_author', '=', 'usr.usr_id')
                ->select(
                    'tkt.tkt_id',
                    'tkt.tkt_label',
                    'tkt.tkt_updated',
                    'tkt.tkt_opendate',
                    'ptr.ptr_name',
                    'tke.tke_label as status',
                    'tke.tke_color as status_color',
                    DB::raw("TRIM(CONCAT_WS(' ', usr.usr_firstname, usr.usr_lastname)) as author_name")
                )
                ->orderBy('tkt.tkt_updated', 'DESC')
                ->limit(15)
                ->get()
                ->map(fn($t) => [
                    'type'    => 'ticket',
                    'id'      => $t->tkt_id,
                    'label'   => $t->tkt_label,
                    'partner' => $t->ptr_name,
                    'status'  => $t->status,
                    'color'   => $t->status_color,
                    'author'  => trim($t->author_name) ?: 'Système',
                    'initials'=> self::initials($t->author_name),
                    'date'    => $t->tkt_updated ?? $t->tkt_opendate,
                    'href'    => '/tickets/' . $t->tkt_id,
                    'module'  => 'Assistance',
                    'mod_color' => '#1a73e8',
                ]);

            $activities = $activities->merge($tickets);
        }

        // ── (Autres modules ajoutables ici) ──────────────────────

        // Tri par date décroissante, on garde les 15 plus récents
        $sorted = $activities
            ->sortByDesc('date')
            ->values()
            ->take(15);

        return response()->json($sorted);
    }

    private static function initials(?string $name): string
    {
        if (!$name || !trim($name)) return '?';
        $parts = array_filter(explode(' ', trim($name)));
        $initials = '';
        foreach ($parts as $part) {
            $initials .= strtoupper(mb_substr($part, 0, 1));
            if (mb_strlen($initials) >= 2) break;
        }
        return $initials ?: '?';
    }
}
