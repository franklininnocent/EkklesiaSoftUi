import { resolveMassIntentionsWorkspace } from './mass-intentions-workspaces.config';

describe('resolveMassIntentionsWorkspace', () => {
  it('maps dashboard and admin routes to home', () => {
    expect(resolveMassIntentionsWorkspace('/mass-intentions')).toBe('home');
    expect(resolveMassIntentionsWorkspace('/mass-intentions/reports')).toBe('home');
    expect(resolveMassIntentionsWorkspace('/mass-intentions/settings')).toBe('home');
    expect(resolveMassIntentionsWorkspace('/mass-intentions/audit')).toBe('home');
  });

  it('maps intentions register to intentions', () => {
    expect(resolveMassIntentionsWorkspace('/mass-intentions/intentions')).toBe('intentions');
  });

  it('maps masses routes to masses', () => {
    expect(resolveMassIntentionsWorkspace('/mass-intentions/masses')).toBe('masses');
    expect(resolveMassIntentionsWorkspace('/mass-intentions/masses/week')).toBe('masses');
    expect(resolveMassIntentionsWorkspace('/mass-intentions/masses/schedule')).toBe('masses');
  });
});
