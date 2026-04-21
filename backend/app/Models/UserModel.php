<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use Illuminate\Foundation\Auth\Access\Authorizable;
use Illuminate\Validation\ValidationException;

/**
 * @property int $usr_id
 * @property string $usr_login
 */

class UserModel extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens, HasRoles;

    /**
     * The guard name for Spatie permissions.
     */
    protected $guard_name = 'sanctum';

    protected static function boot()
    {
        parent::boot();

        static::saving(function (UserModel $user) {
            if ($user->fk_usr_id_manager && $user->isDirty('fk_usr_id_manager')) {
                $user->validateManagerHierarchy();
            }
        });
    }

    /**
     * Valide qu'il n'y a pas de cycle hiérarchique avec le manager.
     * Un utilisateur ne peut pas avoir comme manager quelqu'un qui est dans sa chaîne de subordonnés.
     *
     * @throws ValidationException
     */
    protected function validateManagerHierarchy(): void
    {
        $managerId = $this->fk_usr_id_manager;

        // Un utilisateur ne peut pas être son propre manager
        if ($this->exists && $managerId == $this->usr_id) {
            throw ValidationException::withMessages([
                'fk_usr_id_manager' => ['Un utilisateur ne peut pas être son propre manager.'],
            ]);
        }

        // Si l'utilisateur existe déjà, vérifier que le manager n'est pas dans ses subordonnés
        if ($this->exists) {
            $subordinateIds = $this->getTeamMemberIds();

            if (in_array($managerId, $subordinateIds)) {
                throw ValidationException::withMessages([
                    'fk_usr_id_manager' => ['Ce manager est déjà un subordonné de cet utilisateur. Cela créerait un cycle hiérarchique.'],
                ]);
            }
        }
    }

    protected $table = 'user_usr';
    protected $primaryKey = 'usr_id';
    public $incrementing = true;
    protected $keyType = 'int';

    const CREATED_AT = 'created_at';
    const UPDATED_AT = 'updated_at';

    // Protéger la clé primaire
    protected $guarded = ['usr_id'];


    public function getId(): int
    {
        return $this->usr_id;
    }

    /**
     * Get the password for the user.
     */
    public function getAuthPassword()
    {
        return $this->usr_password;
    }

    /**
     * Get the name of the unique identifier for the user.
     */
    public function getAuthIdentifierName()
    {
        return 'usr_id';
    }

    /**
     * Get the username (login) column name.
     */
    public function username()
    {
        return 'usr_login';
    }

    /**
     * Check if the account is locked.
     */
    public function isLocked(): bool
    {
        if ($this->usr_permanent_lock) {
            return true;
        }

        if ($this->usr_locked_until && $this->usr_locked_until->isFuture()) {
            return true;
        }

        return false;
    }

    protected $fillable = [
        'usr_login',
        'usr_password',
        'usr_firstname',
        'usr_lastname',
        'usr_tel',
        'usr_mobile',
        'usr_jobtitle',
        'usr_is_active',
        'usr_is_seller',
        'usr_is_technician',
        'usr_is_employee',
        'usr_failed_login_attempts',
        'fk_usr_id_author',
        'fk_acc_id_employe',
        'fk_usr_id_manager',
        'usr_gridsettings',
        'clts_id',
        'cltsexclu_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'usr_password',
        'usr_password_reset_token',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'usr_password' => 'hashed',
            'usr_is_active' => 'boolean',
            'usr_is_seller' => 'boolean',
            'usr_is_technician' => 'boolean',
            'usr_is_employee' => 'boolean',
            'usr_permanent_lock' => 'boolean',
            'usr_password_updated_at' => 'datetime',
            'usr_locked_until' => 'datetime',
            'usr_password_reset_token_expires_at' => 'datetime',
        ];
    }

    /**
     * Increment failed login attempts.
     */
    public function incrementLoginAttempts(): void
    {
        $this->increment('usr_failed_login_attempts');

        // Lock account after 5 failed attempts for 15 minutes
        if ($this->usr_failed_login_attempts >= 5) {
            $this->usr_locked_until = now()->addMinutes(15);
            $this->save();
        }
    }

    /**
     * Reset failed login attempts.
     */
    public function resetLoginAttempts(): void
    {
        $this->usr_failed_login_attempts = 0;
        $this->usr_locked_until = null;
        $this->save();
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

    public function profile()
    {
        return $this->belongsTo(UserProfileModel::class, 'fk_usp_id', 'usp_id');
    }

    public function account()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id_employe', 'acc_id');
    }

    /**
     * Le manager de cet utilisateur
     */
    public function manager()
    {
        return $this->belongsTo(UserModel::class, 'fk_usr_id_manager', 'usr_id');
    }

    /**
     * Les membres de l'équipe (utilisateurs gérés par ce manager)
     */
    public function teamMembers()
    {
        return $this->hasMany(UserModel::class, 'fk_usr_id_manager', 'usr_id');
    }

    /**
     * Retourne tous les IDs des membres de l'équipe (récursivement)
     * @return array
     */
    public function getTeamMemberIds(): array
    {
        $ids = [];
        $directReports = $this->teamMembers()->pluck('usr_id')->toArray();
        $ids = array_merge($ids, $directReports);

        foreach ($this->teamMembers as $member) {
            $ids = array_merge($ids, $member->getTeamMemberIds());
        }

        return array_unique($ids);
    }

    /**
     * Compte employé associé
     */
    public function employeeAccount()
    {
        return $this->belongsTo(AccountModel::class, 'fk_acc_id_employe', 'acc_id');
    }

    public function vehicles()
    {
        return $this->hasMany(VehicleModel::class, 'fk_usr_id', 'usr_id');
    }
}
