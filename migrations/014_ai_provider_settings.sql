ALTER TABLE user_settings ADD COLUMN llm_provider_mode TEXT NOT NULL DEFAULT 'auto' CHECK(llm_provider_mode IN ('openai', 'ollama', 'auto'));
ALTER TABLE user_settings ADD COLUMN llm_openai_model TEXT NOT NULL DEFAULT '';
ALTER TABLE user_settings ADD COLUMN llm_ollama_model TEXT NOT NULL DEFAULT '';
