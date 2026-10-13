using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SecureAccess.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeEntraObjectId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EntraObjectId",
                table: "Employees",
                type: "nvarchar(36)",
                maxLength: 36,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_EntraObjectId",
                table: "Employees",
                column: "EntraObjectId",
                unique: true,
                filter: "[EntraObjectId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Employees_EntraObjectId",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "EntraObjectId",
                table: "Employees");
        }
    }
}
