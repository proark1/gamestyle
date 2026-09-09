# Original show audio

The game ships with 28 original stereo recordings: 22 comic effects, three machinery loops and three eight-bar music loops. They are composed and synthesized locally by `scripts/generate-show-audio.mjs`, without third-party samples, imitated songs, speech recordings, or a paid provider dependency. Run the script from the repository root with `node --import tsx games/one-more-button/scripts/generate-show-audio.mjs`.

The music uses an original marimba motif, plucked bass, syncopated brass and drums. The show runs at 120 BPM, chaos after four presses at 144 BPM, and escape at 168 BPM. Scores include wrapped note/reverb tails and matched loop endpoints. The rendered bank is stereo 44.1 kHz, 16-bit PCM, with headroom for layered impacts.

The sound director follows authoritative simulation snapshots: fresh hazards, glove warning/fire cycles, soap slips, feet, door unlock, final countdown, independent team impacts, crowd reactions and distinct win/loss stings. Old events are not replayed when joining or recovering a host. Terminal rounds stop the continuous mix. Leaving restores quiet menu music.

The shared Web Audio player provides gesture unlock, spatial effects, bounded simultaneous playback, smooth music transitions, mute and visibility cleanup. Voice activity ducks the continuous mix. Included files are available in the sound workshop, with saved per-cue and category volumes; generated replacements take precedence. Public manifests contain playback URLs and volumes only.

Automated validation covers all WAV headers/durations, distinct non-silent recordings, clipping headroom and loop seams; soundtrack transitions; four simultaneous launches; snapshot deduplication; hazard timing; movement; door unlock; and saved mix/replacement precedence. Musical quality remains a creative judgment; automated audio analysis is not a physical-device listening test.
