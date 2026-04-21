<?php

namespace App\Http\Controllers\Api;

use App\Models\SequenceModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ApiSequenceController extends Controller
{
    /**
     * Liste toutes les séquences.
     */
    public function index()
    {
        $sequences = SequenceModel::orderBy('seq_module')->orderBy('seq_submodule')->get([
            'seq_id', 'seq_label', 'seq_module', 'seq_submodule',
            'seq_pattern', 'seq_yearly_reset',
            'seq_created', 'seq_updated',
        ]);

        return response()->json(['data' => $sequences]);
    }

    /**
     * Met à jour le pattern et/ou le reset annuel d'une séquence.
     * La création et la suppression sont interdites.
     */
    public function update(Request $request, $id)
    {
        $sequence = SequenceModel::findOrFail($id);

        $data = $request->validate([
            'seq_pattern'      => 'required|string|max:40',
            'seq_yearly_reset' => 'required|boolean',
        ]);

        $sequence->update([
            'seq_pattern'      => $data['seq_pattern'],
            'seq_yearly_reset' => $data['seq_yearly_reset'],
            'fk_seq_id_updater' => Auth::id(),
        ]);

        return response()->json([
            'message' => 'Séquence mise à jour.',
            'data'    => $sequence->only(['seq_id', 'seq_label', 'seq_module', 'seq_submodule', 'seq_pattern', 'seq_yearly_reset']),
        ]);
    }
}
