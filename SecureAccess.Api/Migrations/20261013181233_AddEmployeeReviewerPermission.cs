using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SecureAccess.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeReviewerPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CanReviewAccessRequests",
                table: "Employees",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CanReviewAccessRequests",
                table: "Employees");
        }
    }
}
