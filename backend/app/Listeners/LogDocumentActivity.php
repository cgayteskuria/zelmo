<?php

namespace App\Listeners;

use App\Events\DocumentUploaded;
use App\Events\DocumentDeleted;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class LogDocumentActivity
{
    /**
     * Handle document uploaded event
     *
     * @param DocumentUploaded $event
     * @return void
     */
    public function handleUploaded(DocumentUploaded $event): void
    {
        $document = $event->document;
        $userId = $event->userId;

        // Log to Laravel log
        Log::info('Document uploaded', [
            'document_id' => $document->doc_id,
            'filename' => $document->doc_filename,
            'filesize' => $document->doc_filesize,
            'user_id' => $userId,
            'module' => $this->getModuleFromDocument($document),
        ]);

        // You can also log to database if you have an activity log table
        // DB::table('activity_log')->insert([
        //     'type' => 'document_uploaded',
        //     'document_id' => $document->doc_id,
        //     'user_id' => $userId,
        //     'created_at' => now(),
        // ]);
    }

    /**
     * Handle document deleted event
     *
     * @param DocumentDeleted $event
     * @return void
     */
    public function handleDeleted(DocumentDeleted $event): void
    {
        $document = $event->document;
        $userId = $event->userId;

        // Log to Laravel log
        Log::info('Document deleted', [
            'document_id' => $document->doc_id,
            'filename' => $document->doc_filename,
            'user_id' => $userId,
            'module' => $this->getModuleFromDocument($document),
        ]);

        // You can also log to database if you have an activity log table
        // DB::table('activity_log')->insert([
        //     'type' => 'document_deleted',
        //     'document_id' => $document->doc_id,
        //     'user_id' => $userId,
        //     'created_at' => now(),
        // ]);
    }

    /**
     * Get module name from document
     *
     * @param \App\Models\DocumentModel $document
     * @return string|null
     */
    private function getModuleFromDocument($document): ?string
    {
        $mapping = [
            'fk_ord_id' => 'sale-orders',
            'fk_por_id' => 'purchase-orders',
            'fk_inv_id' => 'invoices',
            'fk_con_id' => 'contracts',
            'fk_dln_id' => 'delivery-notes',
            'fk_ptr_id' => 'partners',
            'fk_che_id' => 'charges',
        ];

        foreach ($mapping as $foreignKey => $module) {
            if ($document->$foreignKey !== null) {
                return $module;
            }
        }

        return null;
    }

    /**
     * Register the listeners for the subscriber
     *
     * @param \Illuminate\Events\Dispatcher $events
     * @return array
     */
    public function subscribe($events): array
    {
        return [
            DocumentUploaded::class => 'handleUploaded',
            DocumentDeleted::class => 'handleDeleted',
        ];
    }
}
