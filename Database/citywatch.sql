-- citywatch.sql
-- Simple schema for CityWatch complaints (for DBMS project)

CREATE TABLE complaints (
  id VARCHAR(20) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  department VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  description TEXT,
  image_path VARCHAR(255),
  created_date DATE NOT NULL
);

-- Sample inserts
INSERT INTO complaints (id,title,department,status,description,created_date) VALUES
('CW-1001','Potholes on King Ave','Roads','Pending','Several large potholes near block 12','2026-06-20'),
('CW-1002','Street light not working','Street Lights','In Progress','Light not working for 2 weeks','2026-06-22'),
('CW-1003','Water leakage near block B','Water','Resolved','Leak fixed by team','2026-06-25');
