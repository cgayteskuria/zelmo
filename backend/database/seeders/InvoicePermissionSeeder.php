<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class InvoicePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset du cache des permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        echo "Création des permissions pour le module 'invoices'...\n";

        // Permissions CRUD pour le module invoices
        $crudPermissions = [
            'invoices.view',
            'invoices.create',
            'invoices.edit',
            'invoices.delete',
        ];

        // Permissions pour la gestion des documents
        $documentPermissions = [
            'invoices.documents.view',
            'invoices.documents.create',
            'invoices.documents.delete',
        ];

        // Permissions additionnelles spécifiques
        $additionalPermissions = [
            'invoices.validate',
            'invoices.print',
        ];

        // Fusion de toutes les permissions
        $allPermissions = array_merge($crudPermissions, $documentPermissions, $additionalPermissions);

        // Création des permissions
        $createdCount = 0;
        $existingCount = 0;

        foreach ($allPermissions as $permissionName) {
            $permission = Permission::firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'sanctum'
            ]);

            if ($permission->wasRecentlyCreated) {
                $createdCount++;
                echo "  ✓ Permission créée : {$permissionName}\n";
            } else {
                $existingCount++;
                echo "  - Permission existante : {$permissionName}\n";
            }
        }

        echo "\n";
        echo "Résumé :\n";
        echo "  - Permissions créées : {$createdCount}\n";
        echo "  - Permissions existantes : {$existingCount}\n";
        echo "  - Total : " . count($allPermissions) . "\n";

        // Assigner toutes les permissions invoices au rôle Administrateur
        $adminRole = Role::where('name', 'Administrateur')->first();

        if ($adminRole) {
            echo "\nAssignation des permissions au rôle 'Administrateur'...\n";

            foreach ($allPermissions as $permissionName) {
                $permission = Permission::findByName($permissionName, 'sanctum');
                if (!$adminRole->hasPermissionTo($permission)) {
                    $adminRole->givePermissionTo($permission);
                    echo "  ✓ Permission assignée : {$permissionName}\n";
                } else {
                    echo "  - Permission déjà assignée : {$permissionName}\n";
                }
            }

            echo "\n✓ Toutes les permissions du module 'invoices' ont été assignées au rôle 'Administrateur'\n";
        } else {
            echo "\n⚠ Rôle 'Administrateur' introuvable. Veuillez créer le rôle d'abord.\n";
        }
    }
}
