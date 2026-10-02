# Blend Business farmer reversals

Approved design: the farmer can return a placed ladder, relock the gate and return delivered keys, and restore fence power. Each action requires proximity and uses the existing interact control without spending inspections. Items return to their starting positions and can be stolen again. Escaped cows remain escaped. Partial key progress can also be reversed; undelivered and carried keys remain untouched.

Implementation: share nearby-action selection between simulation and controls, restore authoritative objective and item state, update contextual desktop/touch guidance, and let the computer farmer repair nearby objectives on patrol. Existing snapshots and scene rendering reflect the reversed state. Verify repeat escapes, proximity, partial deliveries, depleted inspections, and touch availability with the farm test suite.
