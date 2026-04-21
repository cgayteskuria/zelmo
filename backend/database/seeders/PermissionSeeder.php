<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\UserModel;

class PermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset du cache des permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();


        // Définition des modules
        $modules = [
            'accountings',
            'bank-details',
            'charges',
            'contacts',
            'contracts',
            'devices',
            'documents',
            'expenses',
            'invoices',
            'menus',
            'partners',

            'prospects',
            'suppliers',
            'customers',

            'payments',
            'products',
            'purchase-orders',
            'sale-orders',
            'settings',
            'stocks',
            'users',
            'tickets',
            'opportunities',
            'time'
        ];

        // Actions CRUD standard
        $actions = ['view', 'create', 'edit', 'delete'];

        // Création des permissions CRUD pour chaque module
        foreach ($modules as $module) {
            foreach ($actions as $action) {
                Permission::firstOrCreate([
                    'name' => "{$module}.{$action}",
                    'guard_name' => 'sanctum'
                ]);
            }
        }

        // Permissions /settings avec sous-modules
        $settingsSubmodules = [
            'roles',
            'taxs',
            'charges',
            'company',
            'messageemailaccounts',
            'messagetemplates',
            'purchaseorderconf',
            'saleorderconf',
            'invoiceconf',
            'contractconf',
            'ticketingconf',
            'stocks',
            'expenses',
            'prospectconf', // Catégories de dépenses
        ];

        // Création des permissions CRUD pour chaque module
        foreach ($settingsSubmodules as $submodule) {
            foreach ($actions as $action) {
                Permission::firstOrCreate([
                    'name' => "settings.{$submodule}.{$action}",
                    'guard_name' => 'sanctum'
                ]);
            }
        }

        // Permissions pour les documents par module
        // Note: 'expenses' supprimé - utilise expenses.* et expenses.my.* via DocumentPolicy
        $documentModules = [
            'sale-orders',
            'purchase-orders',
            'invoices',
            'contracts',
            'delivery-notes',
            'partners',
            'charges',
            'accountings',
            'account-bank-reconciliations',
        ];
        $documentActions = ['documents.view', 'documents.create', 'documents.delete'];

        foreach ($documentModules as $module) {
            foreach ($documentActions as $action) {
                $additionalPermissions[] = "{$module}.{$action}";
            }
        }

        $additionalPermissions[] = "accountings.restore";

        // Permissions workflow pour les notes de frais
        $additionalPermissions[] = "expenses.approve";     // Approuver/Rejeter les notes de frais de l'équipe
        $additionalPermissions[] = "expenses.approveall";  // Approuver/Rejeter toutes les notes de frais
        //    $additionalPermissions[] = "expenses.pay";         // Marquer les notes comme payées

        // Permissions pour gérer ses propres notes de frais
        $additionalPermissions[] = "expenses.my.view";     // Voir mes notes de frais
        $additionalPermissions[] = "expenses.my.create";   // Créer ma note de frais
        $additionalPermissions[] = "expenses.my.edit";     // Modifier ma note de frais
        $additionalPermissions[] = "expenses.my.delete";   // Supprimer ma note de frais

        $additionalPermissions[] = "opportunities.view_all";
        $additionalPermissions[] = "prospect-activities.view_all";

        $additionalPermissions[] = "time.projects.view";
        $additionalPermissions[] = "time.approve";
        $additionalPermissions[] = "time.invoice";
        foreach ($additionalPermissions as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'sanctum'
            ]);
        }

        // Création du rôle Administrateur avec toutes les permissions
        $adminRole = Role::firstOrCreate([
            'name' => 'Administrateur',
            'guard_name' => 'sanctum'
        ]);

        // Assigner toutes les permissions au rôle Administrateur
        $adminRole->givePermissionTo(Permission::all());

        $totalPermissions = Permission::count();
        echo "✓ Rôle 'Administrateur' créé avec {$totalPermissions} permissions\n";

        // Assigner automatiquement le rôle Administrateur à l'utilisateur ID 84
        $user84 = UserModel::find(84);
        if ($user84) {
            $user84->assignRole('Administrateur');
            echo "✓ Rôle 'Administrateur' assigné à l'utilisateur '{$user84->usr_login}' (ID: {$user84->usr_id})\n";
        } else {
            echo "⚠ Utilisateur ID 84 introuvable. Vous devrez assigner le rôle Administrateur manuellement via Tinker.\n";
        }
    }
}
