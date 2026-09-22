# Push-to-talk interaction

Approved in conversation: expose Push to talk and Open mic before joining; remember the mode and shortcut; show a persistent hold control with a textual Talking state; support keyboard, mouse, and touch; immediately silence on release and focus loss. Keep the current cream/green rounded visual language, Fredoka titles and DM Sans controls. The peer client prepares a disabled track once, then enables it only while held. Leaving, disabling, or switching devices releases hardware.

Implementation: add a prepared-track operation, centralize hold input handling, improve the shared panel and its styles, then validate race handling and real browser audio. Shortcut selection uses a small set of explicit keys, with capture-phase handling to prevent a selected key also triggering gameplay. Typing, modifiers and key repeats do not activate voice. Keyboard and pointer holds combine, so releasing one input does not interrupt another held input. Blur clears all holds.

Validation: unit tests for permission cancellation and input transitions; two real Chrome clients for silent preparation, audible hold, silent release, and repeated holds without reacquiring a microphone. Check the rendered panel at desktop and narrow widths. Legacy LiveKit retains its SDK microphone lifecycle.
