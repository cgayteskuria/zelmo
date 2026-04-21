<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\SaleOrder;

class StoreSaleOrderRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // L'autorisation est gérée par les policies
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $saleOrderId = $this->route('saleOrder') ? $this->route('saleOrder')->id : null;

        return [
            // Informations de base
            'order_date' => ['required', 'date', 'before_or_equal:today'],
            'valid_until' => ['required', 'date', 'after:order_date'],
            'client_reference' => ['nullable', 'string', 'max:50'],

            // Relations obligatoires
            'partner_id' => ['required', 'exists:partners,id'],
            'contact_id' => ['nullable', 'exists:contacts,id'],
            'partner_address' => ['nullable', 'string', 'max:500'],

            // Statuts
            'status' => [
                'nullable',
                Rule::in([
                    SaleOrder::STATUS_DRAFT,
                    SaleOrder::STATUS_WAITING_VALIDATION,
                    SaleOrder::STATUS_REFUSED,
                    SaleOrder::STATUS_IN_PROGRESS,
                    SaleOrder::STATUS_CANCELLED,
                    SaleOrder::STATUS_COMPLETED,
                ])
            ],
            'refusal_reason' => ['nullable', 'string', 'required_if:status,' . SaleOrder::STATUS_REFUSED],

            // Conditions commerciales
            'payment_mode_id' => ['nullable', 'exists:payment_modes,id'],
            'payment_condition_id' => ['nullable', 'exists:durations,id'],
            'commitment_duration_id' => ['nullable', 'exists:durations,id'],
            'seller_id' => ['nullable', 'exists:users,id'],
            'tax_position_id' => ['nullable', 'exists:tax_positions,id'],

            // Notes
            'note' => ['nullable', 'string', 'max:1000'],

            // Lignes de commande
            'lines' => ['nullable', 'array'],
            'lines.*.id' => ['nullable', 'exists:sale_order_lines,id'],
            'lines.*.product_label' => ['required_without:lines.*.line_type', 'string', 'max:150'],
            'lines.*.product_description' => ['nullable', 'string'],
            'lines.*.product_id' => ['nullable', 'exists:products,id'],
            'lines.*.quantity' => ['required_without:lines.*.line_type', 'numeric', 'min:0'],
            'lines.*.unit_price_ht' => ['required_without:lines.*.line_type', 'numeric', 'min:0'],
            'lines.*.purchase_unit_price_ht' => ['nullable', 'numeric', 'min:0'],
            'lines.*.discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lines.*.tax_id' => ['nullable', 'exists:taxes,id'],
            'lines.*.line_order' => ['required', 'integer', 'min:0'],
            'lines.*.line_type' => [
                'required',
                Rule::in([
                    SaleOrderLine::LINE_TYPE_NORMAL,
                    SaleOrderLine::LINE_TYPE_SEPARATOR,
                    SaleOrderLine::LINE_TYPE_SUBTOTAL,
                ])
            ],
            'lines.*.is_subscription' => ['nullable', 'boolean'],
            'lines.*.note' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * Get custom attributes for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'order_date' => 'date de commande',
            'valid_until' => 'date de validité',
            'client_reference' => 'référence client',
            'partner_id' => 'client',
            'contact_id' => 'contact',
            'partner_address' => 'adresse',
            'status' => 'statut',
            'refusal_reason' => 'motif de refus',
            'payment_mode_id' => 'mode de paiement',
            'payment_condition_id' => 'condition de paiement',
            'commitment_duration_id' => 'durée d\'engagement',
            'seller_id' => 'commercial',
            'tax_position_id' => 'position fiscale',
            'note' => 'note',
            'lines.*.product_label' => 'libellé du produit',
            'lines.*.quantity' => 'quantité',
            'lines.*.unit_price_ht' => 'prix unitaire HT',
            'lines.*.discount_percent' => 'remise',
            'lines.*.tax_id' => 'TVA',
        ];
    }

    /**
     * Get custom error messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'order_date.before_or_equal' => 'La date de commande ne peut pas être dans le futur.',
            'valid_until.after' => 'La date de validité doit être postérieure à la date de commande.',
            'refusal_reason.required_if' => 'Le motif de refus est obligatoire lorsque le statut est "Refusé".',
            'lines.*.quantity.min' => 'La quantité doit être supérieure ou égale à 0.',
            'lines.*.unit_price_ht.min' => 'Le prix unitaire HT doit être supérieur ou égal à 0.',
            'lines.*.discount_percent.max' => 'La remise ne peut pas dépasser 100%.',
        ];
    }

    /**
     * Prépare les données pour la validation
     */
    protected function prepareForValidation(): void
    {
        // Définir l'auteur lors de la création
        if (!$this->has('id')) {
            $this->merge([
                'author_id' => auth()->id(),
            ]);
        } else {
            // Définir l'updater lors de la modification
            $this->merge([
                'updater_id' => auth()->id(),
            ]);
        }

        // Si aucun statut n'est fourni, définir par défaut à DRAFT
        if (!$this->has('status')) {
            $this->merge([
                'status' => SaleOrder::STATUS_DRAFT,
            ]);
        }
    }
}
