<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Event;
use App\Models\DocumentModel;
use App\Policies\DocumentPolicy;
use App\Events\DocumentUploaded;
use App\Events\DocumentDeleted;
use App\Listeners\LogDocumentActivity;  

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
       Schema::defaultStringLength(191);

       // Register policies
       Gate::policy(DocumentModel::class, DocumentPolicy::class);

       // Register event listeners
       Event::listen(
           DocumentUploaded::class,
           [LogDocumentActivity::class, 'handleUploaded']
       );

       Event::listen(
           DocumentDeleted::class,
           [LogDocumentActivity::class, 'handleDeleted']
       );
    }
}
