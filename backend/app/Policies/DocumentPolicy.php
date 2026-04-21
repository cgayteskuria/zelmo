<?php

namespace App\Policies;

use App\Models\DocumentModel;
use App\Models\UserModel;
use App\Models\ExpenseModel;
use App\Services\DocumentService;

use Illuminate\Auth\Access\HandlesAuthorization;
use Illuminate\Support\Facades\Auth;

class DocumentPolicy
{
    use HandlesAuthorization;

    /**
     * Module name normalization map.
     * Maps route-level module names to their permission-level equivalents.
     */
    private const MODULE_PERMISSION_MAP = [
        'customer-delivery-notes' => 'delivery-notes',
        'supplier-reception-notes' => 'delivery-notes',
    ];

    /**
     * Normalize module name for permission checks
     */
    private function normalizeModule(string $module): string
    {
        return self::MODULE_PERMISSION_MAP[$module] ?? $module;
    }

    /**
     * Determine if the user can view any documents for a specific module record
     *
     * @param UserModel $user
     * @param string $module
     * @param int $recordId
     * @return bool
     */
    public function viewAny(UserModel $user, string $module, int $recordId): bool
    {
        // Check if user has access to the parent record
        return $this->canAccessModuleRecord($user, $module, $recordId);
    }

    /**
     * Determine if the user can view a specific document
     *
     * @param UserModel $user
     * @param DocumentModel $document
     * @return bool
     */
    public function view(UserModel $user, DocumentModel $document): bool
    {
        // Check if user has access to the parent record
        $module = $this->getModuleFromDocument($document);
        $recordId = $this->getRecordIdFromDocument($document);

        return $this->canAccessModuleRecord($user, $module, $recordId);
    }

    /**
     * Determine if the user can upload documents to a module record
     *
     * @param UserModel $user
     * @param string $module
     * @param int $recordId
     * @return bool
     */
    public function create(UserModel $user, string $module, int $recordId): bool
    {
        // Check if user has edit access to the parent record
        return $this->canEditModuleRecord($user, $module, $recordId);
    }

    /**
     * Determine if the user can delete a document
     *
     * @param UserModel $user
     * @param DocumentModel $document
     * @return bool
     */
    public function delete(UserModel $user, DocumentModel $document): bool
    {
        $module = $this->getModuleFromDocument($document);

        $permModule = $this->normalizeModule($module);
        // D'abord vérifier la permission documents spécifique
        if ($user->can("{$permModule}.documents.delete")) {
            return true;
        }

        // Pour expenses, vérifier ownership et permissions
        if ($module === 'expenses') {
            $recordId = $document->fk_exp_id;
            if ($user->can('expenses.approveall') && $user->can('expenses.delete')) {
                return true;
            }
            if ($this->isExpenseOwner($recordId) && $user->can('expenses.my.delete')) {
                return true;
            }
            if ($this->isExpenseTeamMember($recordId) && $user->can('expenses.delete')) {
                return true;
            }
            return false;
        }

        return false;
    }

    /**
     * Determine if the user can download a document
     *
     * @param UserModel $user
     * @param DocumentModel $document
     * @return bool
     */
    public function download(UserModel $user, DocumentModel $document): bool
    {
        // Same permission as view
        return $this->view($user, $document);
    }

    /**
     * Check if current user is owner of an expense (through expense report)
     *
     * @param int $expenseId
     * @return bool
     */
    private function isExpenseOwner(int $expenseId): bool
    {
        $expense = ExpenseModel::with('expenseReport')->find($expenseId);
        if (!$expense || !$expense->expenseReport) {
            return false;
        }
        return $expense->expenseReport->fk_usr_id === Auth::id();
    }

    /**
     * Check if current user is team member for an expense
     *
     * @param int $expenseId
     * @return bool
     */
    private function isExpenseTeamMember(int $expenseId): bool
    {
        $expense = ExpenseModel::with('expenseReport')->find($expenseId);
        if (!$expense || !$expense->expenseReport) {
            return false;
        }
        $user = Auth::user();
        $teamMemberIds = $user->getTeamMemberIds();
        return in_array($expense->expenseReport->fk_usr_id, $teamMemberIds);
    }

    /**
     * Check if user has access to view a module record
     *
     * @param UserModel $user
     * @param string $module
     * @param int $recordId
     * @return bool
     */
    private function canAccessModuleRecord(UserModel $user, string $module, int $recordId): bool
    {
        $permModule = $this->normalizeModule($module);
        // D'abord vérifier la permission documents spécifique
        if ($user->can("{$permModule}.documents.view")) {
            return true;
        }

        // Pour les articles de ticket : autoriser si l'utilisateur peut consulter les tickets
        if ($module === 'ticket-articles') {
            return $user->can('tickets.view');
        }

        // Pour expenses, vérifier ownership et permissions
        if ($module === 'expenses') {
            if ($user->can('expenses.approveall')) {
                return true;
            }
            if ($this->isExpenseOwner($recordId) && $user->can('expenses.my.view')) {
                return true;
            }
            if ($this->isExpenseTeamMember($recordId) && $user->can('expenses.view')) {
                return true;
            }
            return false;
        }

        return false;
    }

    /**
     * Check if user can edit a module record
     *
     * @param UserModel $user
     * @param string $module
     * @param int $recordId
     * @return bool
     */
    private function canEditModuleRecord(UserModel $user, string $module, int $recordId): bool
    {
        $permModule = $this->normalizeModule($module);
        // D'abord vérifier la permission documents spécifique
        if ($user->can("{$permModule}.documents.create")) {
            return true;
        }

        // Pour les articles de ticket : autoriser si l'utilisateur peut créer ou modifier des tickets
        if ($module === 'ticket-articles') {
            return $user->can('tickets.create') || $user->can('tickets.edit');
        }

        // Pour expenses, vérifier ownership et permissions
        if ($module === 'expenses') {
            if ($user->can('expenses.approveall') && $user->can('expenses.edit')) {
                return true;
            }
            if ($this->isExpenseOwner($recordId) && $user->can('expenses.my.edit')) {
                return true;
            }
            if ($this->isExpenseTeamMember($recordId) && $user->can('expenses.edit')) {
                return true;
            }
            return false;
        }

        return false;
    }

    /**
     * Get module name from document foreign keys
     *
     * @param DocumentModel $document
     * @return string|null
     */
    private function getModuleFromDocument(DocumentModel $document): ?string
    {
  
        foreach (DocumentService::MODULE_MAPPING as $module => $foreignKey) {
            if ($document->$foreignKey !== null) {
                return $module;
            }
        }

        return null;
    }

    /**
     * Get record ID from document foreign keys
     *
     * @param DocumentModel $document
     * @return int|null
     */
    private function getRecordIdFromDocument(DocumentModel $document): ?int
    {
        // Utilise le MODULE_MAPPING du DocumentService
        foreach (DocumentService::MODULE_MAPPING as $module => $foreignKey) {
            if ($document->$foreignKey !== null) {
                return $document->$foreignKey;
            }
        }

        return null;
    }
}
