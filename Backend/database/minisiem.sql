-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 06, 2026 at 07:55 AM
-- Server version: 10.4.27-MariaDB
-- PHP Version: 7.4.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `minisiem`
--

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` int(11) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `organization_id` int(11) DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `verification_token` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admins`
--

INSERT INTO `admins` (`id`, `email`, `password`, `created_at`, `organization_id`, `is_verified`, `verification_token`) VALUES
(1, 'admin@xrsecurity.com', '$2a$10$l7sf6lrxNWs.t6EwDpVNL.yEpcDLEiC2lq4IDPyvImvTxyOusOSba', '2026-04-07 07:48:49', NULL, 1, NULL),
(2, 'eula.lawrence@gmail.com', '$2a$10$AYEYE84KF2/SzWTpGoijSewQONirbTZAgdqe.QPwPj/jU9zGHb1x2', '2026-04-29 04:15:27', 1, 0, NULL),
(4, 'unknown@gmail.com', '$2a$10$OH.iqrzY1xQluyzAOcCUlOqRpUNdLgGnCB6MClzVCgeTdMwm0WQ8i', '2026-05-05 03:21:47', 3, 0, NULL),
(5, 'ninja@gmail.com', '$2a$10$UNwY4NILgit.J8dBhexVX.1frTNwgfg2SAcqUR5sKA5Df76DwQXu.', '2026-05-12 00:12:47', 4, 0, NULL),
(6, 'hick@gmail.com', '$2a$10$/7ki/wnKNcU07Ilwmr.anu12fLak5dV9M4RBt1anVxcNa31Jn08o.', '2026-05-12 04:36:31', 5, 0, NULL),
(9, 'akbar.mulianda.rusdi@gmail.com', '$2a$10$qMa97LjpgbEeQJnfe4n5KePFXjeZrBrG5sUUb0t5RRggRQ.KDcZzO', '2026-05-19 06:48:20', 8, 0, NULL),
(11, 'lkjhgfdsfhjk@gmail.com', '$2a$10$NCL/4si6pNPX8hCcY5EqNOfUhQgLr36l0gkfj7AglVeZ2S4VMjxJS', '2026-05-19 07:00:58', 10, 0, '7febc063849b8734877442c35f9bd245'),
(12, 'lkjhgfdsfk@gmail.com', '$2a$10$IlLTybK2dOKFBYKlvjK4DuRMtEhDG4G6E0QvJZApCceaCdXLMfb.K', '2026-05-19 07:07:12', 11, 0, '5d85ef4ae2a3eb296b544a4c6f91663d'),
(13, 'asdad@gmail.com', '$2a$10$OxcbWXHzONpVTyo4Lu1goece2n4DMaJ1y9Gtd0QE5StpPGdjbNsBK', '2026-05-20 02:05:59', 12, 0, '1f6ee27cc6cab46a67026e2fbbcf9816'),
(15, 'eulsa.lawrence@gmail.com', '$2a$10$OkbEmqbDvQftP5L.o4cWf.DpMm1HJb2Ifsgn/h/bM8CyfuDSOQHF.', '2026-05-29 09:08:09', 14, 0, 'd1b1fbc3fe1b4b1778d78107b1888388'),
(16, 'lauren112@gmail.com', '$2a$10$3NB2V/K5iZDytQ8HOLZ1xeDWF.cW4mjdhJulUtP8XW6kb58HgPL1u', '2026-05-29 09:11:26', 15, 0, '1ae1c2dc243b7054b25be20f2ebccd1e'),
(17, 'laursen112@gmail.com', '$2a$10$LccaeRALQ/m8Te3dJkbqc.Eluvbe6yPIqdZ3gUJL4ujaZ41Laloxa', '2026-05-29 09:16:15', 16, 0, '59881213110a665521da2ca5d571392e'),
(18, 'laursen1129@gmail.com', '$2a$10$7ZRh0xTolu.rfKF3XMbrtepyAFbIoBM752ZHUDy8MDRW182OCznhy', '2026-05-29 09:20:49', 17, 0, '2088e521d0d2e37e4b0585e9fae11dfc'),
(20, 'lazlowkicker@gmail.com', '$2a$10$/8n..iJSyLSGLnLHRwrMXe.0SoITsCCSYz6uwhBdiGsd1H5O6Kj2u', '2026-06-02 09:36:11', 19, 1, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `api_keys`
--

CREATE TABLE `api_keys` (
  `Id` int(11) NOT NULL,
  `Admin_id` int(11) NOT NULL,
  `Key_value` varchar(100) NOT NULL,
  `Is_active` smallint(6) DEFAULT 1,
  `Created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `organization_id` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `api_keys`
--

INSERT INTO `api_keys` (`Id`, `Admin_id`, `Key_value`, `Is_active`, `Created_at`, `organization_id`) VALUES
(3, 1, 'xr_live_6a67db3de6297265c8b51f91595b5afa', 1, '2026-04-08 06:55:30', NULL),
(4, 1, 'xr_live_bfa760221d9e2819809ce65168563365', 1, '2026-04-08 10:55:07', NULL),
(5, 1, 'xr_live_4d84eeaa8377dde0b287b7370fce5202', 1, '2026-04-16 04:42:35', NULL),
(6, 1, 'xr_live_d3e00f9de0922f34676538759e4e0302', 1, '2026-04-21 07:04:14', NULL),
(7, 1, 'xr_live_0866b3404737701fdb1de201def35cdc', 1, '2026-04-29 03:31:18', NULL),
(8, 2, 'xr_live_4eb41dd553f41d9cba75863245b426f1', 1, '2026-04-29 04:17:16', NULL),
(9, 1, 'xr_live_8ae50b18ab63aafaecd07e15bc75afff', 1, '2026-06-03 02:54:06', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `organizations`
--

CREATE TABLE `organizations` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `organizations`
--

INSERT INTO `organizations` (`id`, `name`, `created_at`) VALUES
(1, 'PT Akbar Rusdi', '2026-04-29 04:15:26'),
(2, 'Akbar', '2026-05-03 05:44:08'),
(3, 'UnknownCy', '2026-05-05 03:21:47'),
(4, 'Ligner & Goodman Associates', '2026-05-12 00:12:47'),
(5, 'pouyjuk', '2026-05-12 04:36:30'),
(6, 'Test Org', '2026-05-19 06:43:49'),
(7, 'Jong Uni', '2026-05-19 06:46:28'),
(8, 'qqq', '2026-05-19 06:48:20'),
(9, 'Ligner & Goodman Associate', '2026-05-19 06:56:11'),
(10, 'lkjhgfhjk', '2026-05-19 07:00:57'),
(11, 'lkjhgfhjk', '2026-05-19 07:07:12'),
(12, 'ggggggg', '2026-05-20 02:05:59'),
(13, 'PT Ambpeers', '2026-05-20 02:06:27'),
(14, 'PT Akbar Rusdi', '2026-05-29 09:08:09'),
(15, 'sadsadsad', '2026-05-29 09:11:26'),
(16, 'sadsadsad', '2026-05-29 09:16:15'),
(17, 'sssss', '2026-05-29 09:20:49'),
(18, 'Ligner & Goodman Associates', '2026-06-02 01:33:04'),
(19, 'Ligner & Goodman Associates', '2026-06-02 09:36:11');

-- --------------------------------------------------------

--
-- Table structure for table `security_logs`
--

CREATE TABLE `security_logs` (
  `id` int(11) NOT NULL,
  `admin_id` int(11) DEFAULT NULL,
  `user_identity` varchar(255) DEFAULT NULL,
  `action` varchar(50) DEFAULT NULL,
  `payload` longtext DEFAULT NULL,
  `severity` varchar(20) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `country_code` char(2) DEFAULT NULL,
  `user_agent` longtext DEFAULT NULL,
  `is_blocked` smallint(6) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `crowdsec_alert_id` varchar(100) DEFAULT NULL,
  `source` varchar(20) DEFAULT 'manual',
  `ip_address_public` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `security_logs`
--

INSERT INTO `security_logs` (`id`, `admin_id`, `user_identity`, `action`, `payload`, `severity`, `ip_address`, `country_code`, `user_agent`, `is_blocked`, `created_at`, `crowdsec_alert_id`, `source`, `ip_address_public`) VALUES
(54, 1, 'crowdsec-detection', 'SQL_Injection', '{\"scenario\":\"crowdsecurity/http-sqli-probing\",\"attack_type\":\"SQL_Injection\",\"message\":\"Simulated SQL Injection\",\"events_count\":1,\"source_ip\":\"111.222.111.45\",\"start_at\":\"2026-04-16T12:00:00Z\",\"stop_at\":\"2026-04-16T12:00:05Z\",\"patterns_matched\":[\"\' OR \'1\'=\'1\"],\"http_args\":[\"username=admin\' OR \'1\'=\'1\\u0026password=123\"],\"http_paths\":[\"/login\"],\"decisions\":[\"ban:Ip(111.222.111.45)\"]}', 'Critical', '111.222.111.45', 'ID', 'HackerBrowser/1.0', 0, '0000-00-00 00:00:00', 'cs_99991', 'crowdsec', NULL),
(55, 1, 'crowdsec-detection', 'SQL_Injection', '{\"scenario\":\"crowdsecurity/http-sqli-probing\",\"attack_type\":\"SQL_Injection\",\"message\":\"Simulated SQL Injection\",\"events_count\":2,\"source_ip\":\"101.222.111.45\",\"start_at\":\"2026-04-16T12:00:00Z\",\"stop_at\":\"2026-04-16T12:00:05Z\",\"patterns_matched\":[\"\' OR \'1\'=\'1\"],\"http_args\":[\"username=admin\' OR \'1\'=\'1\\u0026password=123\"],\"http_paths\":[\"/login\"],\"decisions\":[\"ban:Ip(101.222.111.45)\"]}', 'Critical', '101.222.111.45', 'ID', 'HackerBrowser/1.0', 0, '0000-00-00 00:00:00', 'cs_69420', 'crowdsec', NULL),
(56, 1, 'crowdsec-detection', 'XSS_Attempt', '{\"scenario\":\"crowdsecurity/http-xss-probing\",\"attack_type\":\"XSS_Attempt\",\"message\":\"Reflected XSS attempt detected in search query\",\"events_count\":1,\"source_ip\":\"9.150.233.209\",\"start_at\":\"2026-04-16T12:00:00Z\",\"stop_at\":\"2026-04-16T12:00:05Z\",\"patterns_matched\":[\"\\u003cscript\",\"alert(\"],\"http_args\":[\"q=\\u003cscript\\u003ealert(\'XSS_Testing\')\\u003c/script\\u003e\"],\"http_paths\":[\"/search\"],\"decisions\":[\"ban:Ip(9.150.233.209)\"]}', 'Critical', '9.150.233.209', 'CA', 'HackerBrowser/1.0', 0, '2026-04-16 04:00:00', 'cs_441', 'crowdsec', NULL),
(57, 1, 'crowdsec-detection', 'XSS_Attempt', '{\"scenario\":\"crowdsecurity/http-xss-probing\",\"attack_type\":\"XSS_Attempt\",\"message\":\"Reflected XSS attempt detected in search query\",\"events_count\":1,\"source_ip\":\"29.20.68.192\",\"start_at\":\"2026-04-16T12:00:00Z\",\"stop_at\":\"2026-04-16T12:00:05Z\",\"patterns_matched\":[\"\\u003cscript\",\"alert(\"],\"http_args\":[\"q=\\u003cscript\\u003ealert(\'XSS_Testing\')\\u003c/script\\u003e\"],\"http_paths\":[\"/search\"],\"decisions\":[\"ban:Ip(29.20.68.192)\"]}', 'Critical', '29.20.68.192', 'US', 'HackerBrowser/1.0', 0, '2026-04-16 04:00:00', 'cs_44', 'crowdsec', NULL),
(58, 1, 'crowdsec-detection', 'XSS_Attempt', '{\"scenario\":\"crowdsecurity/http-xss-probing\",\"attack_type\":\"XSS_Attempt\",\"message\":\"Reflected XSS attempt detected in search query\",\"events_count\":1,\"source_ip\":\"142.31.140.187\",\"start_at\":\"2026-04-16T12:00:00Z\",\"stop_at\":\"2026-04-16T12:00:05Z\",\"patterns_matched\":[\"\\u003cscript\",\"alert(\"],\"http_args\":[\"q=\\u003cscript\\u003ealert(\'XSS_Testing\')\\u003c/script\\u003e\"],\"http_paths\":[\"/search\"],\"decisions\":[\"ban:Ip(142.31.140.187)\"]}', 'Critical', '142.31.140.187', 'CA', 'HackerBrowser/1.0', 0, '2026-04-16 04:00:00', 'cs_442', 'crowdsec', NULL),
(59, 1, 'crowdsec-detection', 'XSS_Attempt', '{\"scenario\":\"crowdsecurity/http-xss-probing\",\"attack_type\":\"XSS_Attempt\",\"message\":\"Reflected XSS attempt detected in search query\",\"events_count\":1,\"source_ip\":\"124.190.233.134\",\"start_at\":\"2026-04-16T12:00:00Z\",\"stop_at\":\"2026-04-16T12:00:05Z\",\"patterns_matched\":[\"\\u003cscript\",\"alert(\"],\"http_args\":[\"q=\\u003cscript\\u003ealert(\'XSS_Testing\')\\u003c/script\\u003e\"],\"http_paths\":[\"/search\"],\"decisions\":[\"ban:Ip(124.190.233.134)\"]}', 'Critical', '124.190.233.134', 'AU', 'HackerBrowser/1.0', 1, '2026-04-16 04:00:00', 'cs_11', 'crowdsec', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `api_keys`
--
ALTER TABLE `api_keys`
  ADD PRIMARY KEY (`Id`),
  ADD KEY `fk_admin` (`Admin_id`);

--
-- Indexes for table `organizations`
--
ALTER TABLE `organizations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `security_logs`
--
ALTER TABLE `security_logs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_crowdsec_alert` (`crowdsec_alert_id`),
  ADD KEY `admin_id` (`admin_id`),
  ADD KEY `idx_logs_admin_blocked_date` (`admin_id`,`is_blocked`,`created_at`),
  ADD KEY `idx_logs_admin_severity_date` (`admin_id`,`severity`,`created_at`),
  ADD KEY `idx_logs_admin_source` (`admin_id`,`source`),
  ADD KEY `idx_logs_admin_created` (`admin_id`,`created_at`),
  ADD KEY `idx_logs_ip_admin` (`ip_address`,`admin_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `api_keys`
--
ALTER TABLE `api_keys`
  MODIFY `Id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `organizations`
--
ALTER TABLE `organizations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `security_logs`
--
ALTER TABLE `security_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=60;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `api_keys`
--
ALTER TABLE `api_keys`
  ADD CONSTRAINT `fk_admin` FOREIGN KEY (`Admin_id`) REFERENCES `admins` (`id`);

--
-- Constraints for table `security_logs`
--
ALTER TABLE `security_logs`
  ADD CONSTRAINT `security_logs_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
