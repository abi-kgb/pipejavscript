/*
  # Create Pipeline Simulation System Schema

  1. New Tables
    - `pipeline_designs`
      - `id` (uuid, primary key) - Unique identifier for each design
      - `name` (text) - Name of the pipeline design
      - `description` (text) - Optional description
      - `created_at` (timestamptz) - When the design was created
      - `updated_at` (timestamptz) - Last modification time
      - `owner_id` (uuid) - Reference to user who created it
      - `is_public` (boolean) - Whether design is publicly viewable

    - `pipeline_components`
      - `id` (uuid, primary key) - Unique identifier for each component
      - `design_id` (uuid, foreign key) - Reference to pipeline_designs
      - `component_type` (text) - Type: straight, elbow, vertical, valve, filter, tank
      - `position_x` (real) - X coordinate in 3D space
      - `position_y` (real) - Y coordinate in 3D space
      - `position_z` (real) - Z coordinate in 3D space
      - `rotation_x` (real) - X axis rotation in degrees
      - `rotation_y` (real) - Y axis rotation in degrees
      - `rotation_z` (real) - Z axis rotation in degrees
      - `connections` (jsonb) - Array of connection points and linked components
      - `properties` (jsonb) - Component-specific properties (valve state, flow rate, etc.)
      - `created_at` (timestamptz) - When component was added

  2. Security
    - Enable RLS on both tables
    - Users can read their own designs
    - Users can create/update/delete their own designs
    - Public designs are readable by all authenticated users
*/

CREATE TABLE IF NOT EXISTS pipeline_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  owner_id uuid,
  is_public boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS pipeline_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES pipeline_designs(id) ON DELETE CASCADE,
  component_type text NOT NULL,
  position_x real DEFAULT 0,
  position_y real DEFAULT 0,
  position_z real DEFAULT 0,
  rotation_x real DEFAULT 0,
  rotation_y real DEFAULT 0,
  rotation_z real DEFAULT 0,
  connections jsonb DEFAULT '[]'::jsonb,
  properties jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pipeline_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own designs"
  ON pipeline_designs FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can view public designs"
  ON pipeline_designs FOR SELECT
  TO authenticated
  USING (is_public = true);

CREATE POLICY "Users can create own designs"
  ON pipeline_designs FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own designs"
  ON pipeline_designs FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own designs"
  ON pipeline_designs FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can view components of accessible designs"
  ON pipeline_components FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipeline_designs
      WHERE pipeline_designs.id = pipeline_components.design_id
      AND (pipeline_designs.owner_id = auth.uid() OR pipeline_designs.is_public = true)
    )
  );

CREATE POLICY "Users can add components to own designs"
  ON pipeline_components FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipeline_designs
      WHERE pipeline_designs.id = pipeline_components.design_id
      AND pipeline_designs.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update components in own designs"
  ON pipeline_components FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipeline_designs
      WHERE pipeline_designs.id = pipeline_components.design_id
      AND pipeline_designs.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipeline_designs
      WHERE pipeline_designs.id = pipeline_components.design_id
      AND pipeline_designs.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete components from own designs"
  ON pipeline_components FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipeline_designs
      WHERE pipeline_designs.id = pipeline_components.design_id
      AND pipeline_designs.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_pipeline_components_design_id ON pipeline_components(design_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_designs_owner_id ON pipeline_designs(owner_id);
