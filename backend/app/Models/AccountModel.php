<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class AccountModel extends BaseModel
{
    protected $table = 'account_account_acc';
    protected $primaryKey = 'acc_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'acc_created';
    const UPDATED_AT = 'acc_updated';

    // Protéger la clé primaire
    protected $guarded = ['acc_id'];

    /**
     * Récupère les informations de la période comptable
     *
     * @return array
     * @throws \Exception
     */
    public static function getWritingPeriod(): array
    {

        // Récupérer l'exercice courant
        $curExercise = AccountExerciseModel::select('aex_id', 'aex_start_date')
            ->where('aex_is_current_exercise', true)
            ->first();

        // Récupérer l'exercice suivant
        $nextExercise = AccountExerciseModel::select('aex_id', 'aex_end_date')
            ->where('aex_is_next_exercise', true)
            ->first();

        // Vérifier que l'exercice est ouvert
        if ($curExercise == null || $curExercise->aex_id == null) {
            throw new \Exception("L'exercice comptable n'est pas ouvert");
        }

        return [
            'startDate' => $curExercise->aex_start_date,
            'endDate' => $nextExercise ? $nextExercise->aex_end_date : null,
            'curExerciseId' => $curExercise->aex_id,
            'nextExerciseId' => $nextExercise ? $nextExercise->aex_id : null,
        ];
    }

    /**
     * Valide qu'une date se trouve dans la période comptable
     *
     * @param string $date - Date à valider (format YYYY-MM-DD)
     * @return void
     * @throws \Exception
     */
    public static function validateWritingPeriod(string $date): void
    {
        $period = self::getWritingPeriod();

        $startDate = $period['startDate'];
        $endDate = $period['endDate'];

        // Vérifier que la date est dans la période
        if ($date < $startDate->format('Y-m-d')) {
            $dateCarbon  = Carbon::parse($date);
            throw new \Exception(
                sprintf(
                    "La date (%s) est antérieure au début de la période comptable (%s)",
                    $dateCarbon->translatedFormat('d/m/Y'),
                    $startDate->translatedFormat('d/m/Y')
                )
            );
        }

        if ($endDate && $date > $endDate->format('Y-m-d')) {
            $dateCarbon  = Carbon::parse($date);
            throw new \Exception(
                sprintf(
                    "La date (%s) est postérieure à la fin de la période comptable (%s)",
                    $dateCarbon->translatedFormat('d/m/Y'),
                    $endDate->translatedFormat('d/m/Y')
                )
            );
        }
    }

    /**
     * Relations
     */
    public function author()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_author', 'usr_id');
    }

    public function updater()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_updater', 'usr_id');
    }
}
