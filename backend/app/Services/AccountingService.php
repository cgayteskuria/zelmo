<?php

namespace App\Services;


use App\Models\AccountModel;
use App\Models\AccountExerciseModel;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

use Exception;

/**
 * Service d'import des données comptables FEC/CIEL
 * Reproduit la logique de AccountImportEntity.php en Laravel moderne
 */
class AccountingService
{

    /**
     * Vérifie qu'une période est bien dans la période comptable.
     *
     * @param array $filters ['start_date' => 'Y-m-d', 'end_date' => 'Y-m-d']
     * @throws \Exception si la période est invalide
     */
    function validateWritingPeriod(array $filters): void
    {
        $writingPeriod = AccountModel::getWritingPeriod();

        $start_date = $filters['start_date'] ?? null;
        $end_date   = $filters['end_date'] ?? null;

        if ($start_date && $start_date < $writingPeriod['start_date']->format('Y-m-d')) {
            throw new \Exception(
                "La date de début ({$start_date}) est antérieure au début de la période de saisie (" .
                    $writingPeriod['start_date']->format('d/m/Y') . ")"
            );
        }

        if ($end_date && $end_date > $writingPeriod['end_date']->format('Y-m-d')) {
            throw new \Exception(
                "La date de fin ({$end_date}) est postérieure à la fin de l'exercice (" .
                    $writingPeriod['end_date']->format('d/m/Y') . ")"
            );
        }
    }

    /**
     * Récupère l'exercice courant
     * 
     * @return array|null
     */
    public function getCurrentExercise(): ?array
    {
        $exercise = AccountExerciseModel::where('aex_is_current_exercise', 1)->first();

        if (!$exercise) {
            return null;
        }

        return [
            'id'        => $exercise->aex_id,
            'start_date' => $exercise->aex_start_date->format('Y-m-d'),
            'end_date' => $exercise->aex_end_date->format('Y-m-d'),
            'is_closed' => !is_null($exercise->aex_closing_date),
        ];
    }

    /**
     * Récupère l'exercice suivante
     * 
     * @return array|null
     */
    public function getNextExercise(): ?array
    {
        $exercise = AccountExerciseModel::where('aex_is_next_exercise', 1)->first();

        if (!$exercise) {
            return null;
        }

        return [
            'id'        => $exercise->aex_id,
            'start_date' => $exercise->aex_start_date->format('Y-m-d'),
            'end_date' => $exercise->aex_end_date->format('Y-m-d'),
        ];
    }
    /**
     * Ajoute ou met à jour l'exercice courant et l'exercice suivant dans la table account_exercise_aex.
     * Vérifie qu'aucun exercice existant ne couvre déjà exactement la même période avant d'insérer.
     * Vérifie que l'exercice précédent est bien clos
     *    
     * @param string|null $start_date Date de début de l'exercice courant (YYYY-MM-DD)
     * @param string|null $end_date Date de fin de l'exercice courant (YYYY-MM-DD)  
     * @return void
     * @throws Exception
     */
    public function addNewExercise(?string $start_date = null, ?string $end_date = null): void
    {
        try {
            DB::transaction(function () use ($start_date, $end_date) {
                // Trouve l'exercice en cours
                $curExercise = $this->getCurrentExercise();

                // Si aucun exercice n'existe
                if ($curExercise === null) {
                    if (empty($start_date) || empty($end_date)) {
                        throw new Exception("Les périodes de l'exercice sont manquantes");
                    }

                    $curExstart_date = $start_date;
                    $curExend_date = $end_date;

                    // Vérification qu'un exercice avec la même période n'existe pas déjà
                    $existingExercise = AccountExerciseModel::where('aex_start_date', $curExstart_date)
                        ->where('aex_end_date', $curExend_date)
                        ->where('aex_is_current_exercise', 1)
                        ->first();

                    if ($existingExercise) {
                        throw new Exception("Un exercice avec la même période existe déjà dans la base. Opération annulée.");
                    }

                    // Insertion de l'exercice courant
                    AccountExerciseModel::create([
                        'fk_usr_id_author'    => Auth::id(),
                        'fk_usr_id_updater'   => Auth::id(),
                        'aex_start_date'      => $curExstart_date,
                        'aex_end_date'        => $curExend_date,
                        'aex_is_current_exercise' => 1,
                    ]);
                } elseif ($curExercise['is_closed'] === false) {
                    throw new Exception("L'exercice courant n'est pas clos.");
                } else {
                    $curExstart_date = $curExercise['start_date'];
                    $curExend_date = $curExercise['end_date'];

                    // Désactivation de l'exercice N actuel
                    AccountExerciseModel::query()->update([
                        'aex_is_current_exercise' => null,
                        'fk_usr_id_updater'   => Auth::id(),
                    ]);

                    // Calcul de la période du nouvel exercice N
                    $nextstart_date = Carbon::parse($curExend_date)->addDay()->format('Y-m-d');
                    $nextend_date = Carbon::parse($nextstart_date)->addYear()->subDay()->format('Y-m-d');

                    // Test si le nouvel exercice N existe
                    $nextExercise = AccountExerciseModel::where('aex_end_date', $nextend_date)->first();

                    if (!$nextExercise) {
                        // Création du nouvel exercice N
                        AccountExerciseModel::create([
                            'fk_usr_id_author'    => Auth::id(),
                            'fk_usr_id_updater'   => Auth::id(),
                            'aex_start_date'      => $nextstart_date,
                            'aex_end_date'        => $nextend_date,
                            'aex_is_current_exercise' => 1,
                        ]);
                    } else {
                        // L'exercice N+1 devient l'exercice N
                        $nextExercise->update([
                            'aex_is_current_exercise' => 1,
                            'aex_is_next_exercise'    => null,
                            'fk_usr_id_updater'   => Auth::id(),
                        ]);
                    }

                    $curExstart_date = $nextstart_date;
                    $curExend_date = $nextend_date;
                }

                // Calcul de la période de l'exercice N + 1
                $nextstart_date = Carbon::parse($curExend_date)->addDay()->format('Y-m-d');
                $nextend_date = Carbon::parse($nextstart_date)->addYear()->subDay()->format('Y-m-d');

                // Insertion de l'exercice suivant (N+1)
                AccountExerciseModel::create([
                    'fk_usr_id_author'  => Auth::id(),
                    'fk_usr_id_updater' => Auth::id(),
                    'aex_start_date'    => $nextstart_date,
                    'aex_end_date'      => $nextend_date,
                    'aex_is_next_exercise'  => 1,
                ]);
            });
        } catch (Exception $e) {
            throw new Exception("Exception addNewExercise : " . $e->getMessage());
        }
    }
}
