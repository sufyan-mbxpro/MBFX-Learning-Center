-- ADR-120: OpenAI-compatible provider kinds. Appending enum members is a
-- metadata-only change in MariaDB, and ECHO keeps its meaning.
ALTER TABLE `ai_providers` MODIFY `kind` ENUM('ANTHROPIC', 'OPENAI', 'GOOGLE', 'XAI', 'DEEPSEEK', 'MISTRAL', 'OPENROUTER', 'OPENAI_COMPATIBLE', 'ECHO') NOT NULL;

ALTER TABLE `ai_usage` MODIFY `provider` ENUM('ANTHROPIC', 'OPENAI', 'GOOGLE', 'XAI', 'DEEPSEEK', 'MISTRAL', 'OPENROUTER', 'OPENAI_COMPATIBLE', 'ECHO') NOT NULL;

ALTER TABLE `ai_usage_daily` MODIFY `provider` ENUM('ANTHROPIC', 'OPENAI', 'GOOGLE', 'XAI', 'DEEPSEEK', 'MISTRAL', 'OPENROUTER', 'OPENAI_COMPATIBLE', 'ECHO') NOT NULL;
