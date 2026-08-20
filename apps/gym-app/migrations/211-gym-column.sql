UPDATE exercise SET gym = 'anu'  WHERE tab = 'Anu Gym';
UPDATE exercise SET gym = 'home' WHERE tab = 'Home Gym';
UPDATE exercise SET gym = 'main' WHERE tab NOT IN ('Anu Gym', 'Home Gym');
