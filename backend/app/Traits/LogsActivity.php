<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/** @mixin Model */
trait LogsActivity
{
    protected static function bootLogsActivity(): void
    {
        static::created(function ($model) {
            static::writeActivityLog($model, 'created', static::buildSnapshot($model));
        });

        static::updated(function ($model) {
            $changes = static::buildActivityChanges($model);
            if (!empty($changes)) {
                static::writeActivityLog($model, 'updated', $changes);
            }
        });

        static::deleted(function ($model) {
            static::writeActivityLog($model, 'deleted', static::buildSnapshot($model));
        });
    }

    /**
     * Champs identifiants à capturer lors des événements created/deleted.
     * Surcharger dans chaque modèle pour définir les champs pertinents.
     */
    protected static function getLoggableSnapshotFields(): array
    {
        return [];
    }

    protected static function buildSnapshot($model): array
    {
        $fields = static::getLoggableSnapshotFields();
        if (empty($fields)) {
            return [];
        }

        $snapshot = [];
        foreach ($fields as $field) {
            $snapshot[$field] = $model->getAttribute($field);
        }
        return $snapshot;
    }

    protected static function getLogEntityType(): string
    {
        $base = str_replace('Model', '', class_basename(static::class));
        return strtolower(preg_replace('/(?<!^)[A-Z]/', '_$0', $base));
    }

    protected static function getExcludedLogFields(): array
    {
        return ['fk_usr_id_updater', 'fk_usr_id_author'];
    }

    protected static function buildActivityChanges($model): array
    {
        $excluded = array_merge(
            static::getExcludedLogFields(),
            [$model->getKeyName(), $model->getCreatedAtColumn(), $model->getUpdatedAtColumn()]
        );

        $changes = [];
        foreach ($model->getChanges() as $field => $newValue) {
            if (in_array($field, $excluded, true)) {
                continue;
            }
            $changes[$field] = [
                'old' => $model->getOriginal($field),
                'new' => $newValue,
            ];
        }

        return $changes;
    }

    protected static function writeActivityLog($model, string $action, array $changes): void
    {
        try {
            DB::table('logs_log')->insert([
                'log_created'     => now(),
                'log_updated'     => now(),
                'fk_usr_id'       => Auth::id(),
                'log_action'      => $action,
                'log_entity_type' => static::getLogEntityType(),
                'log_entity_id'   => $model->getKey(),
                'log_details'     => !empty($changes) ? json_encode($changes, JSON_UNESCAPED_UNICODE) : null,
                'log_ip_address'  => request()?->ip(),
                'log_user_agent'  => request()?->userAgent(),
            ]);
        } catch (\Throwable $e) {
            logger()->warning('LogsActivity: failed to write log', [
                'entity' => static::getLogEntityType(),
                'action' => $action,
                'error'  => $e->getMessage(),
            ]);
        }
    }
}
