## ADDED Requirements

### Requirement: Recent Applications List
The system SHALL provide a list of recently accessed applications.

#### Scenario: View recent applications
- **WHEN** authenticated user views recent applications
- **THEN** system displays list of recently accessed apps
- **AND** list is sorted by last access time (newest first)
- **AND** list includes: app name, thumbnail, last accessed time, status

#### Scenario: Recent apps limit
- **WHEN** user has many recent apps
- **THEN** system shows limited number of recent apps
- **AND** default limit is configurable (e.g., 10-20)
- **AND** user can load more if needed

#### Scenario: Access app from recents
- **WHEN** user clicks on app in recent list
- **THEN** system opens the application workspace
- **AND** system updates last access time

### Requirement: Recent Activity Tracking
The system SHALL track user activity for recent items.

#### Scenario: Track app open
- **WHEN** user opens an application
- **THEN** system records the access time
- **AND** system updates app's position in recent list

#### Scenario: Track app edit
- **WHEN** user makes changes to an application
- **THEN** system records the activity
- **AND** system updates last modified time
- **AND** system may show edit indicator in recent list

#### Scenario: Track app deployment
- **WHEN** user deploys an application
- **THEN** system records the deployment activity
- **AND** system updates deployment status
- **AND** system may show deployment indicator

### Requirement: Recent Applications Filtering
The system SHALL allow filtering of recent applications.

#### Scenario: Filter by status
- **WHEN** user filters recent apps by status
- **THEN** system shows only apps matching selected status
- **AND** status options: all, draft, published, archived

#### Scenario: Filter by activity type
- **WHEN** user filters recent apps by activity type
- **THEN** system shows only apps with matching activity
- **AND** activity types: all, edited, deployed, viewed

#### Scenario: Search recent apps
- **WHEN** user searches recent apps by name
- **THEN** system filters list to matching apps
- **AND** search is case-insensitive
- **AND** search matches partial names

### Requirement: Recent Applications Sorting
The system SHALL allow sorting of recent applications.

#### Scenario: Sort by last accessed
- **WHEN** user sorts by last accessed
- **THEN** system sorts apps by access time (newest first)
- **AND** this is the default sorting

#### Scenario: Sort by last modified
- **WHEN** user sorts by last modified
- **THEN** system sorts apps by modification time (newest first)
- **AND** apps with recent edits appear first

#### Scenario: Sort alphabetically
- **WHEN** user sorts alphabetically
- **THEN** system sorts apps by name (A-Z)
- **AND** sorting is case-insensitive

### Requirement: Recent Applications Quick Actions
The system SHALL provide quick actions for recent applications.

#### Scenario: Quick open app
- **WHEN** user clicks app in recent list
- **THEN** system opens app workspace
- **AND** this is the primary action

#### Scenario: Quick view app details
- **WHEN** user clicks info icon on recent app
- **THEN** system shows app details popup
- **AND** details include: created time, modified time, versions, deployments

#### Scenario: Quick deploy app
- **WHEN** user clicks deploy icon on recent app
- **THEN** system initiates deployment process
- **AND** user can monitor deployment progress

#### Scenario: Quick delete app
- **WHEN** user clicks delete icon on recent app
- **THEN** system confirms deletion
- **AND** if confirmed, app is deleted
- **AND** app is removed from recent list

### Requirement: Recent Applications Thumbnails
The system SHALL show thumbnails for recent applications.

#### Scenario: Generate app thumbnail
- **WHEN** application is deployed or previewed
- **THEN** system captures screenshot of app
- **AND** system generates thumbnail image
- **AND** thumbnail is stored with app

#### Scenario: Show thumbnail in recent list
- **WHEN** user views recent apps
- **THEN** system shows app thumbnail if available
- **AND** if no thumbnail, shows default icon

#### Scenario: Update thumbnail
- **WHEN** app is redeployed or previewed again
- **THEN** system captures new screenshot
- **AND** system updates thumbnail
- **AND** recent list shows updated thumbnail

### Requirement: Recent Applications Persistence
The system SHALL persist recent applications data.

#### Scenario: Save recent activity
- **WHEN** user activity occurs
- **THEN** system persists activity record
- **AND** record includes: user ID, app ID, activity type, timestamp

#### Scenario: Load recent apps on login
- **WHEN** user logs in
- **THEN** system loads recent apps list
- **AND** list is based on persisted activity records

#### Scenario: Clear recent history
- **WHEN** user clears recent history
- **THEN** system removes recent activity records
- **AND** recent list is cleared
- **AND** actual applications are not deleted

### Requirement: Recent Applications API
The system SHALL provide API access to recent applications.

#### Scenario: Get recent apps via API
- **WHEN** API client requests recent apps
- **THEN** system returns list of recent apps
- **AND** response includes: app info, last access, thumbnail

#### Scenario: Record activity via API
- **WHEN** API client records activity
- **THEN** system persists activity record
- **AND** recent list is updated accordingly

### Requirement: Recent Applications Performance
The system SHALL provide performant recent applications access.

#### Scenario: Fast recent list load
- **WHEN** user opens recent apps
- **THEN** system loads list quickly
- **AND** response time is under acceptable threshold

#### Scenario: Cached recent list
- **WHEN** user accesses recent apps frequently
- **THEN** system may cache recent list
- **AND** cache is invalidated on activity

#### Scenario: Pagination for large history
- **WHEN** user has extensive history
- **THEN** system supports pagination
- **AND** user can load more items incrementally

### Requirement: Recent Applications Integration
The system SHALL integrate recent apps across platform.

#### Scenario: Recent apps in dashboard
- **WHEN** user views dashboard
- **THEN** system shows recent apps section
- **AND** section shows top recent apps

#### Scenario: Recent apps in navigation
- **WHEN** user uses navigation
- **THEN** system may show quick access to recent apps
- **AND** user can switch apps quickly

#### Scenario: Recent apps in search
- **WHEN** user searches across platform
- **THEN** recent apps appear in search results
- **AND** recent apps may be prioritized

### Requirement: Recent Applications Privacy
The system SHALL respect user privacy for recent activity.

#### Scenario: Private recent activity
- **WHEN** user has private apps
- **THEN** recent activity for private apps is protected
- **AND** only user can see their own recent activity

#### Scenario: Incognito mode (future)
- **WHEN** user enables incognito mode
- **THEN** system does not track recent activity
- **AND** apps used in incognito do not appear in recents
