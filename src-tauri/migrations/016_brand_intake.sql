ALTER TABLE projects ADD COLUMN brand_primary_colour TEXT;
ALTER TABLE projects ADD COLUMN brand_secondary_colour TEXT;
ALTER TABLE projects ADD COLUMN brand_tone TEXT;
ALTER TABLE projects ADD COLUMN brand_font_preference TEXT;
ALTER TABLE projects ADD COLUMN brand_has_logo INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN brand_notes TEXT;