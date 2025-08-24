using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BiteTrack.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMealDescription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Meals",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "Meals");
        }
    }
}
