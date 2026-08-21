UPDATE sessions
SET cwd = ?, revision = revision + 1
WHERE id = ?;
