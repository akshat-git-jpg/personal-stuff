import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as repo from '../src/worker/repo';
import type { Env } from '../src/worker/google';
import path from 'path';

function createD1Fake(db: any) {
  return {
    prepare(query: string) {
      const stmt = db.prepare(query);
      const builder = (params: any[]) => ({
        first: async <T>() => stmt.get(...params) as T | undefined,
        all: async <T>() => ({ results: stmt.all(...params) as T[] }),
        run: async () => { stmt.run(...params); return { success: true }; },
        _isFakeStmt: true,
        _runSync: () => stmt.run(...params),
        _allSync: () => ({ results: stmt.all(...params) }),
        _query: query,
      });
      const bound = builder([]);
      return {
        ...bound,
        bind: (...params: any[]) => builder(params),
      };
    },
    async batch(statements: any[]) {
      const results = [];
      for (const s of statements) {
        if (s._query.toUpperCase().startsWith('SELECT')) {
          results.push(s._allSync());
        } else {
          results.push(s._runSync());
        }
      }
      return results;
    }
  };
}

describe('repo', () => {
  let db: any;
  let env: Env;

  beforeEach(() => {
    db = new Database(':memory:');
    const schema = readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
    db.exec(schema);
    env = { DB: createD1Fake(db) } as unknown as Env;
  });

  afterEach(() => {
    db.close();
  });

  it('1. bootstrap returns one group per tab row, in position order, with correct count', async () => {
    db.exec(`
      INSERT INTO tab (name, position, is_mixed) VALUES ('B', 1, 0), ('A', 0, 0);
      INSERT INTO exercise (id, tab, position, name) VALUES ('B1', 'B', 0, 'ex1'), ('B2', 'B', 1, 'ex2');
    `);
    const data = await repo.bootstrap(env);
    expect(data.groups).toHaveLength(2);
    expect(data.groups[0]).toMatchObject({ tab: 'A', count: 0 });
    expect(data.groups[1]).toMatchObject({ tab: 'B', count: 2 });
  });

  it('2. bootstrap sets isMixed true for Anu Gym and false for Chest', async () => {
    db.exec(`
      INSERT INTO tab (name, position, is_mixed) VALUES ('Chest', 0, 0), ('Anu Gym', 1, 1);
    `);
    const data = await repo.bootstrap(env);
    expect(data.groups.find(g => g.tab === 'Anu Gym')?.isMixed).toBe(true);
    expect(data.groups.find(g => g.tab === 'Chest')?.isMixed).toBe(false);
  });

  it('3. bootstrap omits muscleGroup for a non-mixed tab exercise and sets it for a mixed one', async () => {
    db.exec(`
      INSERT INTO tab (name, position, is_mixed) VALUES ('Chest', 0, 0), ('Anu Gym', 1, 1);
      INSERT INTO exercise (id, tab, position, name, muscle_group) VALUES 
        ('C1', 'Chest', 0, 'ex1', 'Chest'),
        ('A1', 'Anu Gym', 0, 'ex2', 'Legs');
    `);
    const data = await repo.bootstrap(env);
    expect(data.exercises['Chest'][0].muscleGroup).toBeUndefined();
    expect(data.exercises['Anu Gym'][0].muscleGroup).toBe('Legs');
  });

  it('4. bootstrap excludes a log row older than RECENT_LOG_DAYS and includes a recent one', async () => {
    const old = new Date(Date.now() - 121 * 86400000).toISOString();
    const recent = new Date(Date.now() - 5 * 86400000).toISOString();
    db.exec(`
      INSERT INTO tab (name, position, is_mixed) VALUES ('Chest', 0, 0);
      INSERT INTO log (ts, exercise_id, exercise, muscle_group, set_no, weight, reps, notes) VALUES 
        ('${old}', 'C1', 'ex1', '', 1, 10, 10, ''),
        ('${recent}', 'C1', 'ex1', '', 1, 10, 10, '');
    `);
    const data = await repo.bootstrap(env);
    expect(data.log).toHaveLength(1);
    expect(data.log[0].date).toBe(recent);
  });

  it('5. readExercises returns exercises ordered by position', async () => {
    db.exec(`
      INSERT INTO tab (name, position, is_mixed) VALUES ('Chest', 0, 0);
      INSERT INTO exercise (id, tab, position, name) VALUES 
        ('C1', 'Chest', 1, 'ex1'),
        ('C2', 'Chest', 0, 'ex2');
    `);
    const data = await repo.readExercises(env, 'Chest');
    expect(data.map(e => e.id)).toEqual(['C2', 'C1']);
  });

  it('6. addExercise on a tab whose ids are C01, C02 returns id C03', async () => {
    db.exec(`
      INSERT INTO tab (name, position, is_mixed) VALUES ('Chest', 0, 0);
      INSERT INTO exercise (id, tab, position, name) VALUES 
        ('C01', 'Chest', 0, 'ex1'),
        ('C02', 'Chest', 1, 'ex2');
    `);
    const ex = await repo.addExercise(env, 'Chest', { name: 'ex3' } as any);
    expect(ex.id).toBe('C03');
  });

  it('7. addExercise on an EMPTY non-mixed tab named Chest returns id C01', async () => {
    db.exec(`INSERT INTO tab (name, position, is_mixed) VALUES ('Chest', 0, 0);`);
    const ex = await repo.addExercise(env, 'Chest', { name: 'ex1' } as any);
    expect(ex.id).toBe('C01');
  });

  it('8. addExercise on the empty Home Gym tab returns id HOME01', async () => {
    db.exec(`INSERT INTO tab (name, position, is_mixed) VALUES ('Home Gym', 0, 1);`);
    const ex = await repo.addExercise(env, 'Home Gym', { name: 'ex1' } as any);
    expect(ex.id).toBe('HOME01');
  });

  it('9. updateExercise with only setsReps leaves name, setting and notes untouched', async () => {
    db.exec(`
      INSERT INTO tab (name, position, is_mixed) VALUES ('Chest', 0, 0);
      INSERT INTO exercise (id, tab, position, name, setting, notes) VALUES 
        ('C01', 'Chest', 0, 'ex1', 'set1', 'note1');
    `);
    const ex = await repo.updateExercise(env, 'Chest', 'C01', { setsReps: '3x10' } as any);
    expect(ex.name).toBe('ex1');
    expect(ex.setting).toBe('set1');
    expect(ex.notes).toBe('note1');
    expect(ex.setsReps).toBe('3x10');
  });

  it('10. reorderExercises with a partial id list puts the unmentioned ids last, preserving their relative order, and re-indexes positions to 0..n-1', async () => {
    db.exec(`
      INSERT INTO tab (name, position, is_mixed) VALUES ('Chest', 0, 0);
      INSERT INTO exercise (id, tab, position, name) VALUES 
        ('C1', 'Chest', 0, 'ex1'),
        ('C2', 'Chest', 1, 'ex2'),
        ('C3', 'Chest', 2, 'ex3'),
        ('C4', 'Chest', 3, 'ex4');
    `);
    const ex = await repo.reorderExercises(env, 'Chest', ['C3', 'C1']);
    expect(ex.map(e => e.id)).toEqual(['C3', 'C1', 'C2', 'C4']);
    expect(ex.map(e => e.order)).toEqual([0, 1, 2, 3]);
  });

  it('11. deleteExercise closes the position gap (remaining positions are 0..n-2)', async () => {
    db.exec(`
      INSERT INTO tab (name, position, is_mixed) VALUES ('Chest', 0, 0);
      INSERT INTO exercise (id, tab, position, name) VALUES 
        ('C1', 'Chest', 0, 'ex1'),
        ('C2', 'Chest', 1, 'ex2'),
        ('C3', 'Chest', 2, 'ex3');
    `);
    await repo.deleteExercise(env, 'Chest', 'C2');
    const data = await repo.readExercises(env, 'Chest');
    expect(data.map(e => e.id)).toEqual(['C1', 'C3']);
    expect(data.map(e => e.order)).toEqual([0, 1]);
  });

  it('12. updateLog with a duplicate timestamp touches exactly one row', async () => {
    db.exec(`
      INSERT INTO log (ts, exercise_id, exercise, muscle_group, set_no, weight, reps, notes) VALUES 
        ('dup', 'C1', 'ex1', '', 1, 10, 10, ''),
        ('dup', 'C1', 'ex1', '', 2, 10, 10, '');
    `);
    await repo.updateLog(env, 'dup', { reps: 5 });
    const data = db.prepare("SELECT * FROM log").all() as any[];
    expect(data.filter(r => r.reps === 5)).toHaveLength(1);
    expect(data.filter(r => r.reps === 10)).toHaveLength(1);
  });
});
