# Reliable placement and rigid-body physics

The reported failures require a shared physical model, not another visual offset. Keep the current game, art style, controls and Railway deployment. Replace scripted stack wobble with Cannon rigid-body simulation: mass, gravity, friction, contacts, angular velocity and fixed time steps. Serialize poses and momentum into the existing authoritative room state so practice and multiplayer use the same rules.

Use one source of collision shapes for rendered salvage, the shed, crane and rescue platform. Compound shapes represent open furniture. Collision checks cover all movement directions, overhead surfaces, falling objects and scenery. Spawn salvage outside scenery. The player controller remains upright and responsive while the physical world resolves contacts.

The displayed preview is an explicit pose: piece ID, x/y/z and quarter-turn rotation. Send that pose unchanged. The server validates reach and overlap, then either places that exact pose or rejects it; it must never choose another height or piece. Use actual visible support surfaces for aiming. Mouse clicks and the action-dock button must preserve the last preview. Render immediate placement without interpolating the object across the yard.

Test flat and compound stacking, removal of supports, natural tipping, falling impacts, rotated shapes, shed entry from every side, crane swept movement and release, obstructed rescue, fixed-step consistency, exact preview placement and stale/concurrent multiplayer commands. Run local browser interaction and public HTTP checks before replacing the Railway deployment. Existing rooms are read compatibly; new pose fields have defaults.
