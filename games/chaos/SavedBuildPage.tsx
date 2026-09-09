'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameScene } from './scene';
import { freshWorld } from './model';
import { enableParty } from './party';
import { configureInspection } from './inspection';
import { restoreBuild, type SavedBuild } from './build-snapshot';
import './saved-build.css';
import { DISASTER_RULES, formatChallengeTime } from './disaster-challenge';
export function SavedBuildPage({ saved }: { saved: SavedBuild }) {
  const challenge = saved.build.challenge;
  const supported = !challenge || challenge.rulesVersion === DISASTER_RULES;
  const mount = useRef<HTMLDivElement>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false,
      scene: GameScene | undefined;
    void import('./scene')
      .then(({ GameScene }) => {
        if (cancelled || !mount.current) return;
        const now = Date.now(),
          world = enableParty(
            freshWorld('sandbox', now, saved.build.brief, saved.build.map),
            now,
            saved.build.seed,
            saved.build.job,
          );
        restoreBuild(world, saved.build, saved.id, 'explore');
        configureInspection(world);
        if (saved.build.delivery)
          Object.assign(world.party!.task, saved.build.delivery, {
            phase: saved.build.delivery.done ? 'done' : 'waiting',
          });
        scene = new GameScene(mount.current, {
          move() {},
          click() {},
          action() {},
          ready() {},
          feedback() {},
        });
        scene.setState({
          world,
          players: [],
          host: '',
          code: '',
          now,
          version: 0,
        });
      })
      .catch(() =>
        setError(
          'The 3D preview could not load. You can still open a copy below.',
        ),
      );
    return () => {
      cancelled = true;
      scene?.dispose();
    };
  }, [saved]);
  return (
    <main className="saved-build-page">
      <header>
        <a href="/chaos">PERMIT PENDING</a>
        <span>{challenge ? 'BEAT OUR DISASTER' : 'COMMUNITY BUILD'}</span>
      </header>
      {challenge && (
        <section className="disaster-invitation">
          <h1>
            Can your crew beat {formatChallengeTime(challenge.elapsedMs)}?
          </h1>
          <p>
            {challenge.crewName} passed with {challenge.crewSize} builder
            {challenge.crewSize === 1 ? '' : 's'}. Take on the same starting
            build and job rules.
          </p>
          {supported ? (
            <nav>
              <a href={`/chaos?build=${saved.id}&play=try`}>Beat this time →</a>
            </nav>
          ) : (
            <p>
              This time was set under older rules. You can still explore or
              remix the build below.
            </p>
          )}
          <p>
            Server-timed from shift start to the customer’s verdict, including
            last call and rescue time. Keep the same crew throughout your
            attempt.
          </p>
        </section>
      )}
      <div
        ref={mount}
        className="saved-build-preview"
        aria-label="Interactive 3D preview of the saved build"
      />
      <section>
        <p>BUILT BY {saved.author}</p>
        <h1>{saved.title}</h1>
        {error && <output>{error}</output>}
        <p>
          {saved.build.pieces.length} pieces · {saved.build.map} site ·{' '}
          {saved.build.format === 'inspection'
            ? 'Will It Hold?'
            : 'Classic chaos'}
        </p>
        {saved.sourceId && (
          <p>
            Based on{' '}
            <a href={`/build/${saved.sourceId}`}>
              this original build or challenge
            </a>
            .
          </p>
        )}
        <nav aria-label="Play this build">
          {!challenge && (
            <a href={`/chaos?build=${saved.id}&play=try`}>Try this delivery</a>
          )}
          <a href={`/chaos?build=${saved.id}&play=explore`}>
            Explore with friends
          </a>
          <a href={`/chaos?build=${saved.id}&play=remix`}>Remix this build</a>
        </nav>
        <p>
          Each option opens your own copy. Invite your crew from inside the
          game. The original build stays intact.
        </p>
      </section>
    </main>
  );
}
