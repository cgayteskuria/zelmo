<?php

namespace App\Events;

use App\Models\DocumentModel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DocumentUploaded
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * The uploaded document
     *
     * @var DocumentModel
     */
    public DocumentModel $document;

    /**
     * The user ID who uploaded the document
     *
     * @var int
     */
    public int $userId;

    /**
     * Create a new event instance
     *
     * @param DocumentModel $document
     * @param int $userId
     */
    public function __construct(DocumentModel $document, int $userId)
    {
        $this->document = $document;
        $this->userId = $userId;
    }
}
