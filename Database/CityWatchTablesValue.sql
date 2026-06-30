INSERT INTO Citizen (full_name, email, phone, address) 
VALUES
('Ali Hassan',    'ali.hassan@email.com',    '0300-1234567', '12-B Model Town, Lahore'),
('Sara Malik',    'sara.malik@email.com',    '0312-9876543', '45 Satellite Town, Rawalpindi'),
('Usman Farooq',  'usman.farooq@email.com',  '0321-4567890', 'G-9/2, Islamabad'),
('Fatima Noor',   'fatima.noor@email.com',   '0333-6543210', 'Gulshan-e-Iqbal, Karachi'),
('Bilal Ahmed',   'bilal.ahmed@email.com',   '0345-1122334', 'Johar Town, Lahore');

INSERT INTO Location (area_name, city, district, pincode, latitude, longitude) 
VALUES
('Model Town',      'Lahore',      'Lahore',      '54000', 31.4834, 74.3207),
('Satellite Town',  'Rawalpindi',  'Rawalpindi',  '46000', 33.6100, 73.0651),
('G-9 Sector',      'Islamabad',   'Islamabad',   '44090', 33.6938, 73.0562),
('Gulshan-e-Iqbal', 'Karachi',     'East',        '75300', 24.9180, 67.1134),
('Johar Town',      'Lahore',      'Lahore',      '54782', 31.4676, 74.2718);

INSERT INTO Department (dept_name, category, contact_email, contact_phone, head_officer) 
VALUES
('Water Supply Authority',    'Water',       'water@citywatch.pk',    '051-111-001', 'Engr. Tariq Mahmood'),
('Roads & Infrastructure',   'Roads',       'roads@citywatch.pk',    '051-111-002', 'Engr. Adnan Rauf'),
('Electricity Board',         'Electricity', 'electric@citywatch.pk', '051-111-003', 'Engr. Kashif Ali'),
('Sanitation Department',     'Sanitation',  'sanit@citywatch.pk',    '051-111-004', 'Mr. Imran Shah'),
('Parks & Recreation',        'Parks',       'parks@citywatch.pk',    '051-111-005', 'Ms. Nadia Hussain');
 
INSERT INTO Staff (dept_id, full_name, designation, email, phone, joined_at) 
VALUES
(1, 'Kamran Iqbal',  'Field Inspector',   'kamran@citywatch.pk', '0300-111-001', '2021-03-15'),
(1, 'Raza Haider',   'Supervisor',        'raza@citywatch.pk',   '0300-111-002', '2019-07-01'),
(2, 'Naeem Butt',    'Road Engineer',     'naeem@citywatch.pk',  '0300-111-003', '2020-01-10'),
(3, 'Zubair Khan',   'Electrician',       'zubair@citywatch.pk', '0300-111-004', '2022-05-20'),
(4, 'Asif Mehmood',  'Sanitation Worker', 'asif@citywatch.pk',   '0300-111-005', '2023-08-01');

INSERT INTO Complaint (citizen_id, dept_id, location_id, staff_id, title, description, category, priority, status)
VALUES
(1, 1, 1, 1, 'No water supply for 3 days',
    'Residents of Block A have had no water since Monday.', 'Water', 'High', 'In Progress'),
(2, 2, 2, 3, 'Pothole on main road',
    'Large pothole causing accidents near City Hospital chowk.', 'Roads', 'High', 'Pending'),
(3, 3, 3, 4, 'Street lights not working',
    'Entire G-9 sector has no street lighting for 5 days.', 'Electricity', 'Medium', 'Pending'),
(4, 4, 4, 5, 'Garbage not collected',
    'No garbage collection for 10 days in Gulshan Block 5.', 'Sanitation', 'Medium', 'In Progress'),
(5, 2, 5, 3, 'Broken pavement near park',
    'Pavement tiles broken and causing hazard for pedestrians.', 'Roads', 'Low', 'Resolved');
 
 INSERT INTO Complaint_History (complaint_id, staff_id, old_status, new_status, remarks) 
 VALUES
(1, 1, 'Pending',     'In Progress', 'Field team dispatched to investigate water main.'),
(4, 5, 'Pending',     'In Progress', 'Sanitation truck scheduled for tomorrow.'),
(5, 3, 'Pending',     'In Progress', 'Repair crew assigned.'),
(5, 3, 'In Progress', 'Resolved',    'Pavement repair completed and inspected.');
