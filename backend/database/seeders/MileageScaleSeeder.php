<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MileageScaleSeeder extends Seeder
{
    /**
     * Bareme kilometrique URSSAF 2024 - Voitures
     */
    public function run(): void
    {
        $year = 2024;
        $vehicleType = 'car';

        $scales = [
            // 3 CV
            ['fiscal_power' => '3', 'min' => 0,     'max' => 5000,  'coeff' => 0.5290, 'const' => 0.00],
            ['fiscal_power' => '3', 'min' => 5001,  'max' => 20000, 'coeff' => 0.3160, 'const' => 1065.00],
            ['fiscal_power' => '3', 'min' => 20001, 'max' => null,  'coeff' => 0.3700, 'const' => 0.00],
            // 4 CV
            ['fiscal_power' => '4', 'min' => 0,     'max' => 5000,  'coeff' => 0.6060, 'const' => 0.00],
            ['fiscal_power' => '4', 'min' => 5001,  'max' => 20000, 'coeff' => 0.3400, 'const' => 1330.00],
            ['fiscal_power' => '4', 'min' => 20001, 'max' => null,  'coeff' => 0.4070, 'const' => 0.00],
            // 5 CV
            ['fiscal_power' => '5', 'min' => 0,     'max' => 5000,  'coeff' => 0.6360, 'const' => 0.00],
            ['fiscal_power' => '5', 'min' => 5001,  'max' => 20000, 'coeff' => 0.3570, 'const' => 1395.00],
            ['fiscal_power' => '5', 'min' => 20001, 'max' => null,  'coeff' => 0.4270, 'const' => 0.00],
            // 6 CV
            ['fiscal_power' => '6', 'min' => 0,     'max' => 5000,  'coeff' => 0.6650, 'const' => 0.00],
            ['fiscal_power' => '6', 'min' => 5001,  'max' => 20000, 'coeff' => 0.3740, 'const' => 1457.00],
            ['fiscal_power' => '6', 'min' => 20001, 'max' => null,  'coeff' => 0.4470, 'const' => 0.00],
            // 7 CV et plus
            ['fiscal_power' => '7+', 'min' => 0,     'max' => 5000,  'coeff' => 0.6970, 'const' => 0.00],
            ['fiscal_power' => '7+', 'min' => 5001,  'max' => 20000, 'coeff' => 0.3940, 'const' => 1515.00],
            ['fiscal_power' => '7+', 'min' => 20001, 'max' => null,  'coeff' => 0.4700, 'const' => 0.00],
        ];

        foreach ($scales as $scale) {
            DB::table('mileage_scale_msc')->updateOrInsert(
                [
                    'msc_year' => $year,
                    'msc_vehicle_type' => $vehicleType,
                    'msc_fiscal_power' => $scale['fiscal_power'],
                    'msc_min_distance' => $scale['min'],
                ],
                [
                    'msc_max_distance' => $scale['max'],
                    'msc_coefficient' => $scale['coeff'],
                    'msc_constant' => $scale['const'],
                    'msc_is_active' => 1,
                ]
            );
        }
    }
}
