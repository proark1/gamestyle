# Shared game toolbar

The game menu now separates frequent actions from preferences. Multiplayer,
voice, mute, help and Settings remain in the header. Multiplayer and voice have
text labels on wide screens; compact screens use labeled icons with 44px targets.
Settings is a single labeled panel on desktop and mobile, with sound volume,
music, appearance, graphics, account when available, and language. English and
German graphics labels are included. The palette remains the collection's cream,
green and muted sage, with rounded rectangular controls and quieter shadows.

The multiplayer control has intrinsic width so its text cannot spill out of an
icon-sized circle. The volume slider is available on touch screens. Settings
stays mounted to preserve nested controls, supports Escape with focus restoration
and outside-click dismissal, and constrains its position and height to the viewport.
Wrong Floor and Sample Stampede use the embedded layout inside existing settings
screens. Act Natural retains its native mobile menu without a nested Settings
button. Legacy mobile wrapping rules were removed from Scaffold Scramble,
Drive Thru and Carry-on Carnage.

The shared component is used by 26 games. Browser checks cover standard and custom
headers, mobile settings, volume changes, graphics expansion, language switching,
keyboard dismissal, and the games with embedded menus. Game simulations and
multiplayer rules are unchanged. This update is local and has not been deployed.

Validation completed: TypeScript, scoped lint, architecture checks and the final
production build passed. All 26 game pages were visited during the browser audit;
standard toolbar layouts, custom menus and embedded settings were inspected.
At 320px, the corrected Scaffold Scramble header remains one row with its return
link, and the Settings panel fits from x=12 to x=308. Drive Thru's open panel uses
the same safe bounds. Appearance opens its existing dialog correctly. Volume and
language test changes were restored to their original values.
