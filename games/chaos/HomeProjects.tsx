'use client';
import { Check, Trophy, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CATALOG, type ItemKind, type World } from './model';
import { homeProgress } from './home-projects';

export function HomeProjects({
  world,
  open,
  onOpenChange,
  onChoose,
}: {
  world: World;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (kind: ItemKind) => void;
}) {
  const projects = homeProgress(world),
    complete = projects.filter((p) => p.complete).length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="game-dialog home-projects-dialog">
        <DialogTitle className="dialog-heading">
          Make yourself at home.
        </DialogTitle>
        <DialogDescription>
          Six projects for your crew. Build on the foundation, on any floor.
          Walk up to a prop and use X or the Use button to try it.
        </DialogDescription>
        <div className="home-projects-summary">
          <Trophy size={20} />
          <strong>
            {complete} / {projects.length} badges
          </strong>
          <span>Based on your current house</span>
        </div>
        <div className="home-projects-grid">
          {projects.map((project) => (
            <section
              key={project.id}
              className={`home-project ${project.complete ? 'complete' : ''}`}
            >
              <div className="home-project-title">
                <h3>{project.title}</h3>
                {project.complete ? (
                  <Check size={20} />
                ) : (
                  <span>
                    {project.done}/{project.total}
                  </span>
                )}
              </div>
              <p>{project.description}</p>
              <div className="home-project-goals">
                {project.goals.map((goal, index) => (
                  <button
                    key={index}
                    onClick={() => onChoose(goal.kind || 'wall')}
                  >
                    <span
                      className={`goal-check ${goal.done === goal.count ? 'done' : ''}`}
                    >
                      {goal.done === goal.count && <Check size={12} />}
                    </span>
                    <span>
                      {goal.kind
                        ? CATALOG.find((i) => i.id === goal.kind)?.name
                        : 'Painted walls'}
                      {goal.tiled ? ' · tiles' : ''}
                      {goal.use ? ' · try it' : ''}
                    </span>
                    <b>
                      {goal.done}/{goal.count}
                    </b>
                    <ArrowRight size={13} />
                  </button>
                ))}
              </div>
              <div className="home-project-reward">
                <Trophy size={14} />
                {project.complete ? 'Earned: ' : 'Badge: '}
                {project.reward}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
