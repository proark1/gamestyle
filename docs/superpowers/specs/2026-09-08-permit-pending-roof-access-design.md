# Crane access to exposed roofs

Roof placement must honor the selected storey while requiring an unobstructed route from above across the entire roof footprint. Any installed part on any higher storey that overlaps this footprint blocks access, including partial overhangs and construction two storeys above. Higher construction elsewhere on the site does not block exposed lower wings. Existing wall-support and reach rules still apply.

Use one shared roof-access check in placement validation and crane pickup. This covers snapping, preview, server actions and the existing final-installation recheck. The error names the blocking storey and asks for an exposed roof position. Invalid placement preserves the suspended load; it does not silently move the target to another storey. A reserved roof origin remains an obstacle for other operations until relocation completes or is cancelled.

Regression coverage includes three storeys, setbacks, partial overlap, rotations, installed versus carried parts, server rejection and retry on the top storey, construction added during travel, pickup and cancellation, and the actual scene preview method. Publish a scoped patch over the verified current Railway release, retaining all unrelated live work.
